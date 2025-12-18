import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { getDb } from '@/lib/db/client';
import { debts, transactions, accounts } from '@/lib/db/schema';
import { getAuthenticatedUser } from '@/lib/api/auth';
import {
  json,
  errorJson,
  formatZodError,
  idSchema,
  centsSchema,
} from '@/lib/api/utils';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ id: string }>;
}

const paymentSchema = z.object({
  amountCents: centsSchema,
  date: z.string().optional(),
});

/**
 * POST /api/v1/debts/:id/payments - Record a payment on a debt
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await getAuthenticatedUser(request);
    if (!auth.success) return auth.response;

    const { id } = await params;
    const idValidation = idSchema.safeParse(id);
    if (!idValidation.success) {
      return errorJson('VALIDATION_ERROR', 'Invalid debt ID', 400);
    }

    const body = await request.json();
    const validation = paymentSchema.safeParse(body);

    if (!validation.success) {
      return json(formatZodError(validation.error), 400);
    }

    const db = getDb();

    // Get the debt
    const [debt] = await db
      .select()
      .from(debts)
      .where(
        and(eq(debts.id, idValidation.data), eq(debts.userId, auth.user.id))
      );

    if (!debt) {
      return errorJson('NOT_FOUND', 'Debt not found', 404);
    }

    const previousStatus = debt.status;
    if (previousStatus !== 'active') {
      return errorJson(
        'INVALID_STATE',
        'Cannot make payment on a non-active debt',
        400
      );
    }

    const now = Date.now();
    const paymentDate =
      validation.data.date || new Date().toISOString().split('T')[0]!;
    const newBalance = Math.max(
      0,
      debt.currentBalanceCents - validation.data.amountCents
    );

    // Auto-set to paid_off if balance reaches 0
    const status = newBalance <= 0 ? 'paid_off' : previousStatus;

    await db
      .update(debts)
      .set({
        currentBalanceCents: newBalance,
        status,
        updatedAt: now,
      })
      .where(eq(debts.id, idValidation.data));

    // Create a transaction record for the payment
    // Find the user's first account to associate with the transaction
    const userAccounts = await db
      .select()
      .from(accounts)
      .where(eq(accounts.userId, auth.user.id));

    let transactionId: string | null = null;
    if (userAccounts.length > 0) {
      // Use the debt's linked account if available, otherwise the first account
      const accountId = debt.accountId || userAccounts[0]!.id;
      transactionId = nanoid();

      await db.insert(transactions).values({
        id: transactionId,
        userId: auth.user.id,
        date: paymentDate,
        description: `Pago de deuda: ${debt.name}`,
        amountCents: validation.data.amountCents,
        type: 'expense',
        accountId,
        cleared: true,
        notes: `Pago automático registrado desde Copiloto de Deudas`,
        createdAt: now,
        updatedAt: now,
      });
    }

    const [updated] = await db
      .select()
      .from(debts)
      .where(eq(debts.id, idValidation.data));

    return NextResponse.json({
      data: updated,
      payment: {
        amountCents: validation.data.amountCents,
        previousBalanceCents: debt.currentBalanceCents,
        newBalanceCents: newBalance,
        debtPaidOff: status === 'paid_off',
        transactionId,
      },
    });
  } catch (error) {
    console.error('Failed to record payment:', error);
    return errorJson('INTERNAL_ERROR', 'Failed to record payment', 500);
  }
}
