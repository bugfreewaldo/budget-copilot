import { NextRequest, NextResponse } from 'next/server';
import { eq, and, desc } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { getDb } from '@/lib/db/client';
import {
  accounts,
  transactions,
  debts,
  scheduledBills,
  scheduledIncome,
  decisionState,
} from '@/lib/db/schema';
import { getAuthenticatedUser } from '@/lib/api/auth';
import { errorJson } from '@/lib/api/utils';

export const dynamic = 'force-dynamic';

const DECISION_VERSION = 'v1.0.0';

type RiskLevel = 'safe' | 'caution' | 'warning' | 'danger' | 'critical';
type CommandType = 'pay' | 'save' | 'spend' | 'freeze' | 'wait';

interface DecisionBasis {
  cashAvailable: number;
  daysUntilPay: number;
  upcomingBillsTotal: number;
  availableAfterBills: number;
  runwayDays: number;
  dailyBurn: number;
  chosenPath: string;
  nextBillDate: string | null;
  nextBillAmount: number;
  dailyBudget: number;
}

interface DecisionOutput {
  riskLevel: RiskLevel;
  primaryCommand: {
    type: CommandType;
    text: string;
    amountCents?: number;
    target?: string;
    date?: string;
  };
  warnings: string[];
  suggestions: string[];
  nextAction: {
    text: string;
    url: string;
  };
  basis: DecisionBasis;
}

function formatCents(cents: number): string {
  return `$${(Math.abs(cents) / 100).toFixed(0)}`;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('es-ES', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function daysBetween(from: Date, to: Date): number {
  const diff = to.getTime() - from.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function getEndOfDay(date: Date): number {
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return end.getTime();
}

async function computeDecision(userId: string): Promise<DecisionOutput> {
  const db = getDb();
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0]!;

  // Get all accounts
  const userAccounts = await db
    .select()
    .from(accounts)
    .where(eq(accounts.userId, userId));

  console.log(
    '[Decision] User accounts:',
    userAccounts.length,
    userAccounts.map((a) => ({ type: a.type, balance: a.currentBalanceCents }))
  );

  // Get all transactions for this user
  const allTransactions = await db
    .select()
    .from(transactions)
    .where(eq(transactions.userId, userId));

  console.log('[Decision] Total transactions:', allTransactions.length);

  // Calculate cash from account balances first
  let cashAvailable = userAccounts
    .filter(
      (a) => a.type === 'checking' || a.type === 'savings' || a.type === 'cash'
    )
    .reduce((sum, a) => sum + (a.currentBalanceCents || 0), 0);

  console.log('[Decision] Cash from account balances:', cashAvailable);

  // If account balances are 0, calculate cash from transactions
  // Cash = total income - total expenses
  if (cashAvailable === 0 && allTransactions.length > 0) {
    const totalIncome = allTransactions
      .filter((tx) => tx.type === 'income')
      .reduce((sum, tx) => sum + Math.abs(tx.amountCents), 0);
    const totalExpenses = allTransactions
      .filter((tx) => tx.type === 'expense')
      .reduce((sum, tx) => sum + Math.abs(tx.amountCents), 0);
    cashAvailable = totalIncome - totalExpenses;
    console.log(
      '[Decision] Calculated from transactions - Income:',
      totalIncome,
      'Expenses:',
      totalExpenses,
      'Cash:',
      cashAvailable
    );
  }

  // Get last 30 days of transactions for burn rate
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0]!;

  const filteredTx = allTransactions.filter(
    (tx) => tx.type === 'expense' && tx.date >= thirtyDaysAgoStr
  );

  const totalSpentLast30Days = filteredTx.reduce(
    (sum, tx) => sum + Math.abs(tx.amountCents),
    0
  );
  const dailyBurn = Math.round(totalSpentLast30Days / 30);

  // Get scheduled income for next payday
  const incomeItems = await db
    .select()
    .from(scheduledIncome)
    .where(
      and(
        eq(scheduledIncome.userId, userId),
        eq(scheduledIncome.status, 'active')
      )
    );

  // Calculate next pay date
  let nextPayDate = new Date();
  nextPayDate.setDate(nextPayDate.getDate() + 14); // Default 2 weeks

  if (incomeItems.length > 0 && incomeItems[0]!.nextPayDate) {
    nextPayDate = new Date(incomeItems[0]!.nextPayDate);
  }

  const daysUntilPay = Math.max(1, daysBetween(today, nextPayDate));

  // Get scheduled bills
  const bills = await db
    .select()
    .from(scheduledBills)
    .where(
      and(
        eq(scheduledBills.userId, userId),
        eq(scheduledBills.status, 'active')
      )
    );

  // Calculate upcoming bills before next payday
  const upcomingBills = bills.filter((bill) => {
    if (!bill.nextDueDate) return false;
    const dueDate = new Date(bill.nextDueDate);
    return dueDate <= nextPayDate;
  });

  const upcomingBillsTotal = upcomingBills.reduce(
    (sum, bill) => sum + bill.amountCents,
    0
  );

  const nextBill = upcomingBills[0];

  // Get debts
  const userDebts = await db
    .select()
    .from(debts)
    .where(and(eq(debts.userId, userId), eq(debts.status, 'active')))
    .orderBy(desc(debts.aprPercent));

  const highestAprDebt = userDebts[0];

  // Calculate available after bills
  const availableAfterBills = cashAvailable - upcomingBillsTotal;

  // Calculate runway
  const runwayDays =
    dailyBurn > 0
      ? Math.floor(Math.max(0, availableAfterBills) / dailyBurn)
      : 999;

  // DECISION LOGIC
  let riskLevel: RiskLevel;
  let primaryCommand: DecisionOutput['primaryCommand'];
  const warnings: string[] = [];
  let nextAction: DecisionOutput['nextAction'];
  let chosenPath: string;

  // Determine risk level
  if (availableAfterBills < 0) {
    riskLevel = 'critical';
  } else if (runwayDays < 3) {
    riskLevel = 'danger';
  } else if (runwayDays < 7) {
    riskLevel = 'warning';
  } else if (runwayDays < 14) {
    riskLevel = 'caution';
  } else {
    riskLevel = 'safe';
  }

  // CRITICAL PATH
  if (availableAfterBills < 0) {
    const deficit = Math.abs(availableAfterBills);
    chosenPath = 'CRITICAL_DEFICIT';

    primaryCommand = {
      type: 'freeze',
      text: `CONGELA todo gasto. Te faltan ${formatCents(deficit)} para cubrir tus gastos fijos. Cualquier compra ahora significa un pago perdido.`,
      amountCents: deficit,
    };

    nextAction = {
      text: 'Ver qué gastos diferir',
      url: '/gastos-fijos',
    };

    if (nextBill) {
      warnings.push(
        `${nextBill.name} (${formatCents(nextBill.amountCents)}) vence ${nextBill.nextDueDate}. No puedes cubrirlo.`
      );
    }
  }
  // DANGER/WARNING PATH
  else if (riskLevel === 'danger' || riskLevel === 'warning') {
    const dailySafe = Math.max(
      0,
      Math.floor(availableAfterBills / daysUntilPay)
    );
    chosenPath =
      riskLevel === 'danger' ? 'DANGER_DAILY_LIMIT' : 'WARNING_DAILY_LIMIT';

    const billAtRisk = nextBill?.name || 'tus gastos fijos';

    primaryCommand = {
      type: 'freeze',
      text: `No excedas ${formatCents(dailySafe)}/día hasta ${formatDate(nextPayDate)}. Pasarte significa que ${billAtRisk} no se paga.`,
      amountCents: dailySafe,
      date: nextPayDate.toISOString().split('T')[0],
    };

    nextAction = {
      text: 'Entendido',
      url: '/dashboard',
    };

    if (nextBill && nextBill.nextDueDate) {
      const daysUntilBill = daysBetween(today, new Date(nextBill.nextDueDate));
      if (daysUntilBill <= 3) {
        warnings.push(
          `${nextBill.name} (${formatCents(nextBill.amountCents)}) vence en ${daysUntilBill} día${daysUntilBill !== 1 ? 's' : ''}.`
        );
      }
    }

    if (riskLevel === 'danger') {
      warnings.push(`Runway: ${runwayDays} días. Cada peso cuenta.`);
    }
  }
  // DEBT PATH
  else if (highestAprDebt && highestAprDebt.currentBalanceCents > 0) {
    const minimumTotal = userDebts.reduce(
      (sum, d) => sum + (d.minimumPaymentCents || 0),
      0
    );
    const safeBuffer = dailyBurn * 14;
    const extraPayment = Math.max(
      0,
      availableAfterBills - safeBuffer - minimumTotal
    );

    if (extraPayment > 5000) {
      chosenPath = 'DEBT_EXTRA_PAYMENT';

      primaryCommand = {
        type: 'pay',
        text: `Paga ${formatCents(extraPayment)} extra a ${highestAprDebt.name} hoy. Esto acelera tu fecha de libertad financiera.`,
        amountCents: extraPayment,
        target: highestAprDebt.name,
        date: todayStr,
      };

      nextAction = {
        text: 'Marcar como pagado',
        url: `/deudas/${highestAprDebt.id}`,
      };
    } else {
      chosenPath = 'SAFE_SPEND_WITH_DEBT';
      const weeklySafe = Math.floor((availableAfterBills / daysUntilPay) * 7);

      primaryCommand = {
        type: 'spend',
        text: `Puedes gastar ${formatCents(weeklySafe)} esta semana. Esto mantiene tus gastos fijos cubiertos y tus pagos de deuda al día.`,
        amountCents: weeklySafe,
      };

      nextAction = {
        text: 'Entendido',
        url: '/dashboard',
      };
    }
  }
  // SAFE PATH
  else {
    chosenPath = 'SAFE_SPEND';
    const weeklySafe = Math.floor((availableAfterBills / daysUntilPay) * 7);

    primaryCommand = {
      type: 'spend',
      text: `Puedes gastar ${formatCents(weeklySafe)} esta semana. Esto mantiene todos tus gastos fijos cubiertos y tu runway arriba de 14 días.`,
      amountCents: weeklySafe,
    };

    nextAction = {
      text: 'Entendido',
      url: '/dashboard',
    };

    if (nextBill && nextBill.nextDueDate) {
      const daysUntilBill = daysBetween(today, new Date(nextBill.nextDueDate));
      if (daysUntilBill <= 5) {
        warnings.push(
          `${nextBill.name} (${formatCents(nextBill.amountCents)}) vence en ${daysUntilBill} días. Estás cubierto.`
        );
      }
    }
  }

  // Calculate daily budget (flexible spending per day)
  const dailyBudget =
    daysUntilPay > 0
      ? Math.max(0, Math.floor(availableAfterBills / daysUntilPay))
      : 0;

  // Build smart suggestions based on situation
  const suggestions: string[] = [];

  // Debt payoff suggestion - if user has debts and some flexible budget
  if (
    highestAprDebt &&
    highestAprDebt.currentBalanceCents > 0 &&
    availableAfterBills > 10000
  ) {
    // Calculate how much extra payment would save
    const extraPayment = Math.min(5000, Math.floor(availableAfterBills * 0.1)); // 10% of available or $50
    const monthsSaved = Math.max(
      1,
      Math.round(extraPayment / (highestAprDebt.minimumPaymentCents || 5000))
    );

    if (extraPayment >= 2500) {
      // At least $25 extra
      suggestions.push(
        `Si pagas ${formatCents(extraPayment)} extra a ${highestAprDebt.name}, podrías terminar ${monthsSaved} mes${monthsSaved > 1 ? 'es' : ''} antes.`
      );
    }
  }

  // Runway suggestion
  if (suggestions.length === 0 && riskLevel === 'safe' && dailyBudget > 5000) {
    suggestions.push(
      'Tu margen financiero es sólido. Considera ahorrar o pagar deuda extra.'
    );
  } else if (suggestions.length === 0 && riskLevel === 'caution' && nextBill) {
    suggestions.push(
      `Tienes gastos fijos próximos. Evita compras grandes hasta el ${nextBill.nextDueDate}.`
    );
  } else if (
    suggestions.length === 0 &&
    dailyBudget === 0 &&
    availableAfterBills > 0
  ) {
    suggestions.push(
      'Tu presupuesto flexible hoy es $0, pero técnicamente tienes margen. Guárdalo para emergencias.'
    );
  }

  // If still no suggestions, add a generic helpful one
  if (suggestions.length === 0 && userDebts.length > 0) {
    const totalDebt = userDebts.reduce(
      (sum, d) => sum + d.currentBalanceCents,
      0
    );
    suggestions.push(
      `Tienes ${formatCents(totalDebt)} en deudas activas. Habla con tu asesor para optimizar tu estrategia de pago.`
    );
  }

  return {
    riskLevel,
    primaryCommand,
    warnings: warnings.slice(0, 2),
    suggestions: suggestions.slice(0, 1),
    nextAction,
    basis: {
      cashAvailable,
      daysUntilPay,
      upcomingBillsTotal,
      availableAfterBills,
      runwayDays,
      dailyBurn,
      chosenPath,
      nextBillDate: nextBill?.nextDueDate || null,
      nextBillAmount: nextBill?.amountCents || 0,
      dailyBudget,
    },
  };
}

/**
 * GET /api/v1/decision - Get current decision
 * Query params:
 *   - refresh=true: Force recompute decision (ignores cache)
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(request);
    if (!auth.success) return auth.response;

    const db = getDb();
    const userId = auth.user.id;
    const userPlan = auth.user.plan || 'free';
    const now = Date.now();
    const forceRefresh = request.nextUrl.searchParams.get('refresh') === 'true';

    console.log(
      '[Decision API] userId:',
      userId,
      'plan:',
      userPlan,
      'forceRefresh:',
      forceRefresh
    );

    // Check for expired decision
    const [lockedDecision] = await db
      .select()
      .from(decisionState)
      .where(
        and(eq(decisionState.userId, userId), eq(decisionState.isLocked, true))
      )
      .orderBy(desc(decisionState.computedAt))
      .limit(1);

    const hasExpiredDecision = !!lockedDecision;

    // Check for existing valid decision (skip if force refresh)
    const [existing] = forceRefresh
      ? [undefined]
      : await db
          .select()
          .from(decisionState)
          .where(
            and(
              eq(decisionState.userId, userId),
              eq(decisionState.isLocked, false)
            )
          )
          .orderBy(desc(decisionState.computedAt))
          .limit(1);

    let decision: DecisionOutput;
    let state: typeof existing;
    let hoursRemaining: number;

    // If exists and not expired, use it (unless force refresh)
    if (existing && existing.expiresAt > now) {
      hoursRemaining = Math.ceil((existing.expiresAt - now) / (1000 * 60 * 60));

      const parsedBasis = existing.decisionBasisJson
        ? JSON.parse(existing.decisionBasisJson)
        : {};

      decision = {
        riskLevel: existing.riskLevel as RiskLevel,
        primaryCommand: {
          type: existing.primaryCommandType as CommandType,
          text: existing.primaryCommandText,
          amountCents: existing.primaryCommandAmount || undefined,
          target: existing.primaryCommandTarget || undefined,
          date: existing.primaryCommandDate || undefined,
        },
        warnings: [existing.warning1, existing.warning2].filter(
          Boolean
        ) as string[],
        suggestions: [], // Suggestions are not stored in DB, computed fresh
        nextAction: {
          text: existing.nextActionText,
          url: existing.nextActionUrl,
        },
        basis: {
          ...parsedBasis,
          // Ensure new fields have defaults if missing from old cached data
          nextBillDate: parsedBasis.nextBillDate ?? null,
          nextBillAmount: parsedBasis.nextBillAmount ?? 0,
          dailyBudget: parsedBasis.dailyBudget ?? 0,
        },
      };
      state = existing;
    } else {
      // Lock old decision if exists
      if (existing) {
        await db
          .update(decisionState)
          .set({ isLocked: true })
          .where(eq(decisionState.id, existing.id));
      }

      // Compute new decision
      decision = await computeDecision(userId);

      // Calculate expiration
      const expiresAt = getEndOfDay(new Date());
      hoursRemaining = Math.ceil((expiresAt - now) / (1000 * 60 * 60));

      // Create new state
      const newState = {
        id: nanoid(),
        userId,
        decisionVersion: DECISION_VERSION,
        riskLevel: decision.riskLevel,
        primaryCommandType: decision.primaryCommand.type,
        primaryCommandText: decision.primaryCommand.text,
        primaryCommandAmount: decision.primaryCommand.amountCents,
        primaryCommandTarget: decision.primaryCommand.target,
        primaryCommandDate: decision.primaryCommand.date,
        warning1: decision.warnings[0] || null,
        warning2: decision.warnings[1] || null,
        nextActionText: decision.nextAction.text,
        nextActionUrl: decision.nextAction.url,
        decisionBasisJson: JSON.stringify(decision.basis),
        computedAt: now,
        expiresAt,
        isLocked: false,
      };

      await db.insert(decisionState).values(newState);
      state = newState as typeof existing;
    }

    // For free users: return signals, not specifics (authority tone, no jargon)
    if (userPlan === 'free') {
      return NextResponse.json({
        data: {
          id: state!.id,
          isPaid: false,
          riskLevel: decision.riskLevel,
          warnings: decision.warnings.map((w) => {
            if (w.includes('vence en')) {
              const match = w.match(/vence en (\d+)/);
              if (match) {
                return `Gasto fijo vence en ${match[1]} días`;
              }
            }
            if (w.includes('Runway') || w.includes('runway')) {
              return 'Tu margen financiero es limitado';
            }
            if (w.includes('peso cuenta')) {
              return 'El margen actual no cubre todos los compromisos';
            }
            return 'Hay poco espacio para errores esta semana';
          }),
          teaser: 'Tu próxima acción financiera está lista.',
          hasExpiredDecision,
          hoursRemaining: 0,
        },
      });
    }

    // For paid users: full decision
    console.log('[Decision API] Returning for paid user - context:', {
      cashAvailable: decision.basis.cashAvailable,
      upcomingBillsTotal: decision.basis.upcomingBillsTotal,
      dailyBudget: decision.basis.dailyBudget,
    });

    return NextResponse.json({
      data: {
        id: state!.id,
        isPaid: true,
        riskLevel: decision.riskLevel,
        primaryCommand: decision.primaryCommand,
        warnings: decision.warnings,
        nextAction: decision.nextAction,
        hoursRemaining,
        hasExpiredDecision,
        computedAt: state!.computedAt,
        expiresAt: state!.expiresAt,
        context: {
          cashAvailable: decision.basis.cashAvailable,
          daysUntilPay: decision.basis.daysUntilPay,
          upcomingBillsTotal: decision.basis.upcomingBillsTotal,
          runwayDays: decision.basis.runwayDays,
          nextBillDate: decision.basis.nextBillDate,
          nextBillAmount: decision.basis.nextBillAmount,
          dailyBudget: decision.basis.dailyBudget,
        },
        suggestions: decision.suggestions,
      },
    });
  } catch (error) {
    console.error('Failed to get decision:', error);
    return errorJson('INTERNAL_ERROR', 'Failed to get decision', 500);
  }
}
