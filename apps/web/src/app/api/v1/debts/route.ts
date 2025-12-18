import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { eq, desc } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { getDb } from '@/lib/db/client';
import { debts } from '@/lib/db/schema';
import { getAuthenticatedUser } from '@/lib/api/auth';
import {
  json,
  errorJson,
  formatZodError,
  idSchema,
  centsSchema,
} from '@/lib/api/utils';

export const dynamic = 'force-dynamic';

/**
 * Calculate months to payoff and total interest for a debt
 */
function calculatePayoff(
  balanceCents: number,
  aprPercent: number,
  minimumPaymentCents: number | null
): { monthsToPayoff: number; totalInterestCents: number } {
  const minPayment = minimumPaymentCents || Math.ceil(balanceCents * 0.02);

  if (minPayment <= 0 || balanceCents <= 0) {
    return { monthsToPayoff: 0, totalInterestCents: 0 };
  }

  const monthlyRate = aprPercent / 100 / 12;
  let balance = balanceCents;
  let months = 0;
  let totalInterest = 0;

  // Simple amortization calculation
  while (balance > 0 && months < 600) {
    const interest = Math.round(balance * monthlyRate);
    totalInterest += interest;
    balance = balance + interest - minPayment;
    months++;
  }

  // If we hit 600 months, it's essentially unpayable with minimum payments
  if (months >= 600) {
    return { monthsToPayoff: -1, totalInterestCents: -1 };
  }

  return { monthsToPayoff: months, totalInterestCents: totalInterest };
}

/**
 * Calculate death date (payoff date) from months to payoff
 */
function calculateDeathDate(monthsToPayoff: number): string | null {
  if (monthsToPayoff <= 0) return null;

  const deathDate = new Date();
  deathDate.setMonth(deathDate.getMonth() + monthsToPayoff);
  return deathDate.toISOString().split('T')[0]!;
}

/**
 * Get danger multiplier based on debt type
 * Some debts (like mortgages) are investments/necessities, not purely negative
 */
function getDangerMultiplier(debtType: string): {
  multiplier: number;
  maxScore: number;
} {
  switch (debtType) {
    case 'mortgage':
      // Mortgages: secured by appreciating asset, builds equity, often tax-deductible
      return { multiplier: 0.3, maxScore: 40 };
    case 'student_loan':
      // Student loans: investment in earning potential
      return { multiplier: 0.5, maxScore: 50 };
    case 'auto_loan':
      // Auto loans: secured but depreciating asset, often necessary
      return { multiplier: 0.6, maxScore: 60 };
    case 'credit_card':
      // Credit cards: high APR, unsecured, revolving - most dangerous
      return { multiplier: 1.0, maxScore: 100 };
    case 'personal_loan':
      // Personal loans: usually high APR, unsecured
      return { multiplier: 0.9, maxScore: 100 };
    case 'medical':
      // Medical debt: often interest-free or low interest, but can be urgent
      return { multiplier: 0.7, maxScore: 70 };
    default:
      return { multiplier: 0.8, maxScore: 80 };
  }
}

/**
 * Calculate danger score (0-100) based on debt characteristics
 * Higher score = more dangerous
 * Accounts for debt type (mortgages/student loans are less "dangerous")
 */
function calculateDangerScore(
  balanceCents: number,
  aprPercent: number,
  minimumPaymentCents: number | null,
  monthsToPayoff: number,
  debtType: string = 'other'
): number {
  const { multiplier, maxScore } = getDangerMultiplier(debtType);
  let score = 0;

  // APR component (0-40 points): higher APR = more dangerous
  // 0% = 0 points, 30%+ = 40 points
  score += Math.min(40, (aprPercent / 30) * 40);

  // Payoff time component (0-30 points): longer payoff = more dangerous
  // For mortgages/student loans, long payoff is expected and less concerning
  if (monthsToPayoff > 0) {
    score += Math.min(30, ((monthsToPayoff - 12) / 48) * 30);
  } else if (monthsToPayoff === -1) {
    // Essentially infinite payoff time
    score += 30;
  }

  // Interest coverage component (0-30 points): if min payment barely covers interest
  const monthlyInterestCents = Math.round(
    (balanceCents * (aprPercent / 100)) / 12
  );
  const minPayment = minimumPaymentCents || Math.ceil(balanceCents * 0.02);

  if (minPayment > 0) {
    const interestCoverageRatio =
      minPayment / Math.max(1, monthlyInterestCents);
    // If payment barely covers interest (ratio ~1), score is high
    // If payment covers 3x+ interest, score is low
    if (interestCoverageRatio <= 1) {
      score += 30; // Very dangerous - payment doesn't cover interest
    } else if (interestCoverageRatio < 2) {
      score += 20; // Dangerous - payment barely covers interest
    } else if (interestCoverageRatio < 3) {
      score += 10; // Moderate
    }
    // >= 3 ratio = 0 additional points (healthy)
  }

  // Apply type multiplier and cap at type's max score
  const adjustedScore = Math.round(score * multiplier);
  return Math.max(0, Math.min(maxScore, adjustedScore));
}

/**
 * Enrich a debt with calculated fields (deathDate, dangerScore, totalInterestProjectedCents)
 */
function enrichDebt(debt: {
  currentBalanceCents: number;
  originalBalanceCents: number;
  aprPercent: number;
  minimumPaymentCents: number | null;
  termMonths: number | null;
  startDate: string | null;
  status: string;
  type: string;
  deathDate: string | null;
  dangerScore: number | null;
  totalInterestProjectedCents: number | null;
  [key: string]: unknown;
}) {
  if (debt.status !== 'active' || debt.currentBalanceCents <= 0) {
    return {
      ...debt,
      deathDate: null,
      dangerScore: null,
      totalInterestProjectedCents: null,
    };
  }

  // For fixed-term loans with a start date and term, calculate death date from those
  let deathDate: string | null = null;
  let monthsToPayoff = 0;
  let totalInterestCents = 0;

  if (debt.termMonths && debt.startDate) {
    // Fixed-term loan: death date = start date + term months
    const startDate = new Date(debt.startDate);
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + debt.termMonths);
    deathDate = endDate.toISOString().split('T')[0]!;

    // Calculate remaining months from now
    const now = new Date();
    const remainingMonths = Math.max(
      0,
      Math.ceil(
        (endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 30)
      )
    );
    monthsToPayoff = remainingMonths;

    // Estimate total interest based on fixed term amortization
    if (debt.minimumPaymentCents && debt.termMonths > 0) {
      const totalPayments = debt.minimumPaymentCents * debt.termMonths;
      totalInterestCents = Math.max(
        0,
        totalPayments - debt.originalBalanceCents
      );
    }
  } else {
    // Variable/revolving debt: calculate based on minimum payments
    const payoff = calculatePayoff(
      debt.currentBalanceCents,
      debt.aprPercent,
      debt.minimumPaymentCents
    );
    monthsToPayoff = payoff.monthsToPayoff;
    totalInterestCents = payoff.totalInterestCents;
    deathDate = calculateDeathDate(monthsToPayoff);
  }

  return {
    ...debt,
    deathDate,
    dangerScore: calculateDangerScore(
      debt.currentBalanceCents,
      debt.aprPercent,
      debt.minimumPaymentCents,
      monthsToPayoff,
      debt.type
    ),
    totalInterestProjectedCents:
      totalInterestCents >= 0 ? totalInterestCents : null,
  };
}

const createDebtSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum([
    'credit_card',
    'personal_loan',
    'auto_loan',
    'mortgage',
    'student_loan',
    'medical',
    'other',
  ]),
  accountId: idSchema.nullable().optional(),
  originalBalanceCents: centsSchema,
  currentBalanceCents: centsSchema,
  aprPercent: z.number().min(0).max(100),
  minimumPaymentCents: centsSchema.nullable().optional(),
  termMonths: z.number().int().positive().max(480).nullable().optional(), // max 40 years for mortgages
  startDate: z.string().nullable().optional(),
  dueDay: z.number().int().min(1).max(31).nullable().optional(),
  nextDueDate: z.string().nullable().optional(),
});

/**
 * GET /api/v1/debts - List all debts for the user
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(request);
    if (!auth.success) return auth.response;

    const db = getDb();
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');

    const userDebts = await db
      .select()
      .from(debts)
      .where(eq(debts.userId, auth.user.id))
      .orderBy(desc(debts.createdAt));

    // Filter by status if specified
    const filteredDebts = status
      ? userDebts.filter((d) => d.status === status)
      : userDebts;

    // Calculate summary - field names must match frontend DebtSummary interface
    const activeDebts = filteredDebts.filter((d) => d.status === 'active');
    const summary = {
      totalDebtCents: activeDebts.reduce(
        (sum, d) => sum + d.currentBalanceCents,
        0
      ),
      totalMinPaymentCents: activeDebts.reduce(
        (sum, d) => sum + (d.minimumPaymentCents || 0),
        0
      ),
      activeCount: activeDebts.length,
    };

    // Enrich debts with calculated fields
    const enrichedDebts = filteredDebts.map(enrichDebt);

    return NextResponse.json({ data: enrichedDebts, summary });
  } catch (error) {
    console.error('Failed to list debts:', error);
    return errorJson('INTERNAL_ERROR', 'Failed to list debts', 500);
  }
}

/**
 * POST /api/v1/debts - Create a new debt
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(request);
    if (!auth.success) return auth.response;

    const body = await request.json();
    const validation = createDebtSchema.safeParse(body);

    if (!validation.success) {
      return json(formatZodError(validation.error), 400);
    }

    const data = validation.data;
    const db = getDb();

    const id = nanoid();
    const now = Date.now();

    await db.insert(debts).values({
      id,
      userId: auth.user.id,
      name: data.name,
      type: data.type,
      accountId: data.accountId || null,
      originalBalanceCents: data.originalBalanceCents,
      currentBalanceCents: data.currentBalanceCents,
      aprPercent: data.aprPercent,
      minimumPaymentCents: data.minimumPaymentCents || null,
      termMonths: data.termMonths || null,
      startDate: data.startDate || null,
      dueDay: data.dueDay || null,
      nextDueDate: data.nextDueDate || null,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    });

    const [debt] = await db.select().from(debts).where(eq(debts.id, id));

    if (!debt) {
      return errorJson(
        'INTERNAL_ERROR',
        'Failed to retrieve created debt',
        500
      );
    }

    return NextResponse.json({ data: enrichDebt(debt) }, { status: 201 });
  } catch (error) {
    console.error('Failed to create debt:', error);
    return errorJson('INTERNAL_ERROR', 'Failed to create debt', 500);
  }
}
