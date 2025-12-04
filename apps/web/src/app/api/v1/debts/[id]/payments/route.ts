import { NextRequest } from 'next/server';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { and, eq } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { debts } from '@/lib/db/schema';
import {
  formatZodError,
  json,
  errorJson,
  isoDateSchema,
} from '@/lib/api/utils';

const recordPaymentSchema = z.object({
  amount_cents: z.number().int().positive(),
  principal_cents: z.number().int().min(0).optional(),
  interest_cents: z.number().int().min(0).optional(),
  payment_date: isoDateSchema,
});

type RouteContext = { params: Promise<{ id: string }> };

/**
 * POST /api/v1/debts/[id]/payments - Record a payment
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const validation = recordPaymentSchema.safeParse(body);

    if (!validation.success) {
      return json(formatZodError(validation.error), 400);
    }

    const db = getDb();
    const userId = 'test-user-00000000000000000001';

    const [debt] = await db
      .select()
      .from(debts)
      .where(and(eq(debts.id, id), eq(debts.userId, userId)));

    if (!debt) {
      return errorJson('NOT_FOUND', 'Debt not found', 404);
    }

    // Update the debt balance
    const newBalance = Math.max(
      0,
      debt.currentBalanceCents - validation.data.amount_cents
    );

    const updates: Record<string, unknown> = {
      currentBalanceCents: newBalance,
      updatedAt: Date.now(),
    };

    // Mark as paid off if balance is 0
    if (newBalance === 0) {
      updates.status = 'paid_off';
    }

    await db.update(debts).set(updates).where(eq(debts.id, id));

    // Return a payment record (simplified - no separate payments table for now)
    const payment = {
      id: nanoid(),
      debtId: id,
      transactionId: null,
      amountCents: validation.data.amount_cents,
      principalCents: validation.data.principal_cents ?? null,
      interestCents: validation.data.interest_cents ?? null,
      paymentDate: validation.data.payment_date,
      createdAt: Date.now(),
    };

    return json({ data: payment }, 201);
  } catch (error) {
    console.error('Failed to record payment:', error);
    return errorJson('DB_ERROR', 'Failed to record payment', 500, {
      error: (error as Error).message,
    });
  }
}
