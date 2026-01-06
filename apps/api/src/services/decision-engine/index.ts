/**
 * Decision Engine - The Core Product
 *
 * BudgetCopilot decides. Not calculates.
 * Every command includes: Action + Consequence
 *
 * Version: v1.0.0
 */

import { getDb } from '../../db/client.js';
import {
  accounts,
  transactions,
  debts,
  recurringTransactions,
  decisionState,
  type NewDecisionState,
} from '../../db/schema.js';
import { eq, and, gte, desc } from 'drizzle-orm';
import { nanoid } from 'nanoid';

const DECISION_VERSION = 'v1.0.0';

// Types
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
  highestAprDebt?: { name: string; apr: number; balance: number };
  nextBill?: { name: string; amount: number; dueDate: string };
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
  nextAction: {
    text: string;
    url: string;
  };
  basis: DecisionBasis;
}

// Helper functions
function formatCents(cents: number): string {
  return `$${(Math.abs(cents) / 100).toFixed(0)}`;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
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

function calculateDebtFreeDate(
  debts: Array<{ balance: number; apr: number; minimum: number }>,
  extraPayment: number
): Date {
  // Simplified calculation - avalanche method
  let totalBalance = debts.reduce((sum, d) => sum + d.balance, 0);
  const avgApr = debts.reduce((sum, d) => sum + d.apr, 0) / debts.length || 0;
  const monthlyPayment =
    debts.reduce((sum, d) => sum + d.minimum, 0) + extraPayment;

  if (monthlyPayment <= 0) {
    return new Date(Date.now() + 365 * 10 * 24 * 60 * 60 * 1000); // 10 years
  }

  let months = 0;
  while (totalBalance > 0 && months < 360) {
    const monthlyInterest = (totalBalance * (avgApr / 100)) / 12;
    const principal = monthlyPayment - monthlyInterest;
    totalBalance -= principal;
    months++;
  }

  const futureDate = new Date();
  futureDate.setMonth(futureDate.getMonth() + months);
  return futureDate;
}

function calculateDaysSaved(
  debts: Array<{ balance: number; apr: number; minimum: number }>,
  extraPayment: number
): number {
  const withoutExtra = calculateDebtFreeDate(debts, 0);
  const withExtra = calculateDebtFreeDate(debts, extraPayment);
  return daysBetween(withExtra, withoutExtra);
}

/**
 * Compute the decision for a user
 * This is the brain of BudgetCopilot
 */
export async function computeDecision(userId: string): Promise<DecisionOutput> {
  const db = await getDb();
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0]!;

  // Get all accounts and calculate total cash
  const userAccounts = await db
    .select()
    .from(accounts)
    .where(eq(accounts.userId, userId));

  const cashAvailable = userAccounts
    .filter(
      (a) => a.type === 'checking' || a.type === 'savings' || a.type === 'cash'
    )
    .reduce((sum, a) => sum + (a.currentBalanceCents || 0), 0);

  // Get last 30 days of transactions for burn rate
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0]!;

  const recentTransactions = await db
    .select()
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        eq(transactions.type, 'expense'),
        gte(transactions.date, thirtyDaysAgoStr)
      )
    );

  const totalSpentLast30Days = recentTransactions.reduce(
    (sum, tx) => sum + Math.abs(tx.amountCents),
    0
  );
  const dailyBurn = Math.round(totalSpentLast30Days / 30);

  // Get recurring transactions to find next payday and bills
  const recurring = await db
    .select()
    .from(recurringTransactions)
    .where(eq(recurringTransactions.status, 'active'))
    .orderBy(recurringTransactions.nextExpectedDate);

  // Find income entries for payday calculation
  const incomeRecurring = recurring.filter((r) => r.type === 'income');

  // Calculate next pay date
  let nextPayDate = new Date();
  nextPayDate.setDate(nextPayDate.getDate() + 14); // Default 2 weeks

  if (incomeRecurring.length > 0 && incomeRecurring[0]!.nextExpectedDate) {
    nextPayDate = new Date(incomeRecurring[0]!.nextExpectedDate);
  }

  const daysUntilPay = Math.max(1, daysBetween(today, nextPayDate));

  // Get upcoming bills (expense recurring transactions)
  const bills = recurring.filter((r) => r.type === 'expense');

  // Calculate upcoming bills before next payday
  const upcomingBills = bills.filter((bill) => {
    if (!bill.nextExpectedDate) return false;
    const dueDate = new Date(bill.nextExpectedDate);
    return dueDate <= nextPayDate;
  });

  const upcomingBillsTotal = upcomingBills.reduce(
    (sum, bill) => sum + bill.expectedAmountCents,
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

  // DECISION LOGIC - Priority Order:
  // 1. CRITICAL: Can't cover upcoming bills
  // 2. DANGER: Runway < 3 days
  // 3. WARNING: Runway < 7 days
  // 4. DEBT: Has high-APR debt and spare cash
  // 5. SAFE: Normal spending guidance

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

  // CRITICAL PATH - Can't cover bills
  if (availableAfterBills < 0) {
    const deficit = Math.abs(availableAfterBills);
    chosenPath = 'CRITICAL_DEFICIT';

    primaryCommand = {
      type: 'freeze',
      text: `FREEZE all spending. You are ${formatCents(deficit)} short for upcoming bills. Any purchase now means a missed payment.`,
      amountCents: deficit,
    };

    nextAction = {
      text: 'See which bills to defer',
      url: '/recurrentes',
    };

    if (nextBill) {
      warnings.push(
        `${nextBill.name} (${formatCents(nextBill.expectedAmountCents)}) due ${nextBill.nextExpectedDate}. You cannot cover it.`
      );
    }
  }
  // DANGER/WARNING PATH - Low runway
  else if (riskLevel === 'danger' || riskLevel === 'warning') {
    const dailySafe = Math.max(
      0,
      Math.floor(availableAfterBills / daysUntilPay)
    );
    chosenPath =
      riskLevel === 'danger' ? 'DANGER_DAILY_LIMIT' : 'WARNING_DAILY_LIMIT';

    const billAtRisk = nextBill?.name || 'your bills';

    primaryCommand = {
      type: 'freeze',
      text: `Do not exceed ${formatCents(dailySafe)}/day until ${formatDate(nextPayDate)}. Going over means ${billAtRisk} gets missed.`,
      amountCents: dailySafe,
      date: nextPayDate.toISOString().split('T')[0],
    };

    nextAction = {
      text: 'I understand',
      url: '/dashboard',
    };

    if (nextBill && nextBill.nextExpectedDate) {
      const daysUntilBill = daysBetween(
        today,
        new Date(nextBill.nextExpectedDate)
      );
      if (daysUntilBill <= 3) {
        warnings.push(
          `${nextBill.name} (${formatCents(nextBill.expectedAmountCents)}) due in ${daysUntilBill} day${daysUntilBill !== 1 ? 's' : ''}.`
        );
      }
    }

    if (riskLevel === 'danger') {
      warnings.push(`Runway: ${runwayDays} days. Every dollar counts.`);
    }
  }
  // DEBT PATH - Has debt and spare cash
  else if (highestAprDebt && highestAprDebt.currentBalanceCents > 0) {
    const minimumTotal = userDebts.reduce(
      (sum, d) => sum + (d.minimumPaymentCents || 0),
      0
    );
    const safeBuffer = dailyBurn * 14; // 2 week buffer
    const extraPayment = Math.max(
      0,
      availableAfterBills - safeBuffer - minimumTotal
    );

    if (extraPayment > 5000) {
      // At least $50 extra
      chosenPath = 'DEBT_EXTRA_PAYMENT';

      const daysSaved = calculateDaysSaved(
        userDebts.map((d) => ({
          balance: d.currentBalanceCents,
          apr: d.aprPercent,
          minimum: d.minimumPaymentCents || 0,
        })),
        extraPayment
      );

      primaryCommand = {
        type: 'pay',
        text: `Pay ${formatCents(extraPayment)} extra to ${highestAprDebt.name} today. This shortens your debt-free date by ${daysSaved} days.`,
        amountCents: extraPayment,
        target: highestAprDebt.name,
        date: todayStr,
      };

      nextAction = {
        text: 'Mark as paid',
        url: `/deudas/${highestAprDebt.id}`,
      };

      // Calculate debt-free date
      const debtFreeDate = calculateDebtFreeDate(
        userDebts.map((d) => ({
          balance: d.currentBalanceCents,
          apr: d.aprPercent,
          minimum: d.minimumPaymentCents || 0,
        })),
        extraPayment / 100 // Convert to dollars for monthly calc
      );

      warnings.push(
        `Debt-free by ${formatDate(debtFreeDate)} if you keep this up.`
      );
    } else {
      // Just pay minimums
      chosenPath = 'DEBT_MINIMUM';

      const nextDebtDue = userDebts.find((d) => d.nextDueDate);
      if (nextDebtDue && nextDebtDue.minimumPaymentCents) {
        primaryCommand = {
          type: 'pay',
          text: `Pay ${formatCents(nextDebtDue.minimumPaymentCents)} minimum to ${nextDebtDue.name} by ${nextDebtDue.nextDueDate}. Missing this adds fees and damages your credit.`,
          amountCents: nextDebtDue.minimumPaymentCents,
          target: nextDebtDue.name,
          date: nextDebtDue.nextDueDate || undefined,
        };

        nextAction = {
          text: 'Mark as paid',
          url: `/deudas/${nextDebtDue.id}`,
        };
      } else {
        // Fallback to safe spend
        chosenPath = 'SAFE_SPEND_WITH_DEBT';
        const weeklySafe = Math.floor((availableAfterBills / daysUntilPay) * 7);

        primaryCommand = {
          type: 'spend',
          text: `You can spend ${formatCents(weeklySafe)} this week. This keeps bills covered and debt payments on track.`,
          amountCents: weeklySafe,
        };

        nextAction = {
          text: 'Got it',
          url: '/dashboard',
        };
      }
    }
  }
  // SAFE PATH - Normal spending guidance
  else {
    chosenPath = 'SAFE_SPEND';
    const weeklySafe = Math.floor((availableAfterBills / daysUntilPay) * 7);

    primaryCommand = {
      type: 'spend',
      text: `You can spend ${formatCents(weeklySafe)} this week. This keeps all bills covered and your runway above 14 days.`,
      amountCents: weeklySafe,
    };

    nextAction = {
      text: 'Got it',
      url: '/dashboard',
    };

    // Check for upcoming bills as info
    if (nextBill && nextBill.nextExpectedDate) {
      const daysUntilBill = daysBetween(
        today,
        new Date(nextBill.nextExpectedDate)
      );
      if (daysUntilBill <= 5) {
        warnings.push(
          `${nextBill.name} (${formatCents(nextBill.expectedAmountCents)}) due in ${daysUntilBill} days. You're covered.`
        );
      }
    }
  }

  // Build basis (internal only)
  const basis: DecisionBasis = {
    cashAvailable,
    daysUntilPay,
    upcomingBillsTotal,
    availableAfterBills,
    runwayDays,
    dailyBurn,
    chosenPath,
    highestAprDebt: highestAprDebt
      ? {
          name: highestAprDebt.name,
          apr: highestAprDebt.aprPercent,
          balance: highestAprDebt.currentBalanceCents,
        }
      : undefined,
    nextBill: nextBill
      ? {
          name: nextBill.name,
          amount: nextBill.expectedAmountCents,
          dueDate: nextBill.nextExpectedDate || '',
        }
      : undefined,
  };

  return {
    riskLevel,
    primaryCommand,
    warnings: warnings.slice(0, 2), // Max 2 warnings
    nextAction,
    basis,
  };
}

/**
 * Get or compute decision for a user
 * Returns cached decision if valid, otherwise computes new one
 */
export async function getOrComputeDecision(userId: string): Promise<{
  decision: DecisionOutput;
  state: NewDecisionState;
  isNew: boolean;
  hoursRemaining: number;
}> {
  const db = await getDb();
  const now = Date.now();

  // Check for existing valid decision
  const [existing] = await db
    .select()
    .from(decisionState)
    .where(
      and(eq(decisionState.userId, userId), eq(decisionState.isLocked, false))
    )
    .orderBy(desc(decisionState.computedAt))
    .limit(1);

  // If exists and not expired, return it
  if (existing && existing.expiresAt > now) {
    const hoursRemaining = Math.ceil(
      (existing.expiresAt - now) / (1000 * 60 * 60)
    );

    const decision: DecisionOutput = {
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
      nextAction: {
        text: existing.nextActionText,
        url: existing.nextActionUrl,
      },
      basis: existing.decisionBasisJson
        ? JSON.parse(existing.decisionBasisJson)
        : {},
    };

    return {
      decision,
      state: existing,
      isNew: false,
      hoursRemaining,
    };
  }

  // Lock old decision if exists
  if (existing) {
    await db
      .update(decisionState)
      .set({ isLocked: true })
      .where(eq(decisionState.id, existing.id));
  }

  // Compute new decision
  const decision = await computeDecision(userId);

  // Calculate expiration (end of today in user's timezone - simplified to UTC)
  const expiresAt = getEndOfDay(new Date());
  const hoursRemaining = Math.ceil((expiresAt - now) / (1000 * 60 * 60));

  // Create new state
  const newState: NewDecisionState = {
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

  // Save to database
  await db.insert(decisionState).values(newState);

  return {
    decision,
    state: newState,
    isNew: true,
    hoursRemaining,
  };
}

/**
 * Acknowledge a decision (user clicked "I understand")
 */
export async function acknowledgeDecision(decisionId: string): Promise<void> {
  const db = await getDb();
  await db
    .update(decisionState)
    .set({ acknowledgedAt: Date.now() })
    .where(eq(decisionState.id, decisionId));
}

/**
 * Get last locked decision (for "yesterday's expired" message)
 */
export async function getLastLockedDecision(userId: string): Promise<boolean> {
  const db = await getDb();
  const [locked] = await db
    .select()
    .from(decisionState)
    .where(
      and(eq(decisionState.userId, userId), eq(decisionState.isLocked, true))
    )
    .orderBy(desc(decisionState.computedAt))
    .limit(1);

  return !!locked;
}
