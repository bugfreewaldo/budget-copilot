import { NextRequest } from 'next/server';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { and, eq, desc } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { debts } from '@/lib/db/schema';
import { formatZodError, json, errorJson, idSchema } from '@/lib/api/utils';

/**
 * Debt validation schemas
 */
const debtTypeSchema = z.enum([
  'credit_card',
  'personal_loan',
  'auto_loan',
  'mortgage',
  'student_loan',
  'medical',
  'other',
]);

const debtStatusSchema = z.enum([
  'active',
  'paid_off',
  'defaulted',
  'deferred',
]);

const createDebtSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  type: debtTypeSchema,
  original_balance_cents: z.number().int().positive(),
  current_balance_cents: z.number().int().min(0),
  apr_percent: z.number().min(0).max(100),
  minimum_payment_cents: z.number().int().min(0).optional(),
  due_day: z.number().int().min(1).max(31).optional(),
  account_id: idSchema.optional().nullable(),
});

const listDebtsQuerySchema = z.object({
  cursor: idSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  status: debtStatusSchema.optional(),
});

/**
 * Calculate danger score for a debt
 */
function calculateDangerScore(debt: {
  aprPercent: number;
  currentBalanceCents: number;
  minimumPaymentCents: number | null;
}): number {
  let score = 0;

  // High APR = more dangerous (0-40 points)
  if (debt.aprPercent >= 25) score += 40;
  else if (debt.aprPercent >= 18) score += 30;
  else if (debt.aprPercent >= 12) score += 20;
  else if (debt.aprPercent >= 6) score += 10;

  // High balance = more dangerous (0-40 points)
  const balanceDollars = debt.currentBalanceCents / 100;
  if (balanceDollars >= 50000) score += 40;
  else if (balanceDollars >= 20000) score += 30;
  else if (balanceDollars >= 10000) score += 20;
  else if (balanceDollars >= 5000) score += 10;

  // Low minimum payment relative to balance = slower payoff (0-20 points)
  if (debt.minimumPaymentCents && debt.currentBalanceCents > 0) {
    const ratio = (debt.minimumPaymentCents / debt.currentBalanceCents) * 100;
    if (ratio < 1) score += 20;
    else if (ratio < 2) score += 15;
    else if (ratio < 3) score += 10;
  }

  return Math.min(100, score);
}

/**
 * Calculate death date (payoff date with minimum payments)
 */
function calculateDeathDate(debt: {
  currentBalanceCents: number;
  aprPercent: number;
  minimumPaymentCents: number | null;
}): string | null {
  if (!debt.minimumPaymentCents || debt.minimumPaymentCents <= 0) return null;
  if (debt.currentBalanceCents <= 0) return 'Pagada';

  const monthlyRate = debt.aprPercent / 100 / 12;
  let balance = debt.currentBalanceCents;
  let months = 0;
  const maxMonths = 360; // 30 years max

  while (balance > 0 && months < maxMonths) {
    const interest = balance * monthlyRate;
    const payment = Math.min(debt.minimumPaymentCents, balance + interest);
    balance = balance + interest - payment;
    months++;
  }

  if (months >= maxMonths) return 'Nunca (con mínimo)';

  const deathDate = new Date();
  deathDate.setMonth(deathDate.getMonth() + months);
  return deathDate.toISOString().split('T')[0] ?? null;
}

/**
 * GET /api/v1/debts - List debts with summary
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = {
      cursor: searchParams.get('cursor') || undefined,
      limit: searchParams.get('limit') || undefined,
      status: searchParams.get('status') || undefined,
    };

    const validation = listDebtsQuerySchema.safeParse(query);
    if (!validation.success) {
      return json(formatZodError(validation.error), 400);
    }

    const db = getDb();
    const userId = 'test-user-00000000000000000001';
    const conditions = [eq(debts.userId, userId)];

    if (validation.data.status) {
      conditions.push(eq(debts.status, validation.data.status));
    }

    const result = await db
      .select()
      .from(debts)
      .where(and(...conditions))
      .orderBy(desc(debts.dangerScore), desc(debts.currentBalanceCents))
      .limit(validation.data.limit);

    // Calculate summary
    const activeDebts = result.filter((d) => d.status === 'active');
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

    return json({
      data: result,
      summary,
      nextCursor: null,
      count: result.length,
    });
  } catch (error) {
    console.error('Failed to list debts:', error);
    return errorJson('DB_ERROR', 'Failed to retrieve debts', 500, {
      error: (error as Error).message,
    });
  }
}

/**
 * POST /api/v1/debts - Create new debt
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validation = createDebtSchema.safeParse(body);

    if (!validation.success) {
      return json(formatZodError(validation.error), 400);
    }

    const db = getDb();
    const userId = 'test-user-00000000000000000001';
    const id = nanoid();
    const now = Date.now();

    const dangerScore = calculateDangerScore({
      aprPercent: validation.data.apr_percent,
      currentBalanceCents: validation.data.current_balance_cents,
      minimumPaymentCents: validation.data.minimum_payment_cents ?? null,
    });

    const deathDate = calculateDeathDate({
      currentBalanceCents: validation.data.current_balance_cents,
      aprPercent: validation.data.apr_percent,
      minimumPaymentCents: validation.data.minimum_payment_cents ?? null,
    });

    await db.insert(debts).values({
      id,
      userId,
      name: validation.data.name,
      type: validation.data.type,
      accountId: validation.data.account_id || null,
      originalBalanceCents: validation.data.original_balance_cents,
      currentBalanceCents: validation.data.current_balance_cents,
      aprPercent: validation.data.apr_percent,
      minimumPaymentCents: validation.data.minimum_payment_cents || null,
      dueDay: validation.data.due_day || null,
      status: 'active',
      dangerScore,
      deathDate,
      createdAt: now,
      updatedAt: now,
    });

    const [debt] = await db.select().from(debts).where(eq(debts.id, id));

    return json({ data: debt }, 201);
  } catch (error) {
    console.error('Failed to create debt:', error);
    return errorJson('DB_ERROR', 'Failed to create debt', 500, {
      error: (error as Error).message,
    });
  }
}
