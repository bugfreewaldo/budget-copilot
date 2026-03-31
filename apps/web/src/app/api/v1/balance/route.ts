import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { getDb } from '@/lib/db/client';
import { transactions, accounts } from '@/lib/db/schema';
import { getAuthenticatedUser } from '@/lib/api/auth';
import { errorJson, json, formatZodError } from '@/lib/api/utils';

export const dynamic = 'force-dynamic';

const COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000; // 7 days between adjustments

const setBalanceSchema = z.object({
  actualBalanceCents: z.number().int(),
});

/**
 * GET /api/v1/balance - Get current calculated balance and last adjustment info
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(request);
    if (!auth.success) return auth.response;

    const db = getDb();
    const userId = auth.user.id;

    // Calculate current balance from all transactions
    const userTransactions = await db
      .select()
      .from(transactions)
      .where(eq(transactions.userId, userId));

    const currentBalanceCents = userTransactions.reduce(
      (sum, tx) => sum + tx.amountCents,
      0
    );

    // Find last balance adjustment
    const lastAdjustment = userTransactions
      .filter(
        (tx) =>
          tx.description.startsWith('[Balance Adjustment]') ||
          tx.description.startsWith('[Opening Balance]')
      )
      .sort((a, b) => b.createdAt - a.createdAt)[0];

    const canAdjust =
      !lastAdjustment || Date.now() - lastAdjustment.createdAt > COOLDOWN_MS;
    const nextAdjustmentAt = lastAdjustment
      ? lastAdjustment.createdAt + COOLDOWN_MS
      : null;

    return NextResponse.json({
      data: {
        currentBalanceCents,
        transactionCount: userTransactions.length,
        lastAdjustment: lastAdjustment
          ? {
              date: lastAdjustment.date,
              amountCents: lastAdjustment.amountCents,
              createdAt: lastAdjustment.createdAt,
            }
          : null,
        canAdjust,
        nextAdjustmentAt,
      },
    });
  } catch (error) {
    console.error('Failed to get balance:', error);
    return errorJson('INTERNAL_ERROR', 'Failed to get balance', 500);
  }
}

/**
 * POST /api/v1/balance - Set actual balance (creates adjustment transaction)
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(request);
    if (!auth.success) return auth.response;

    const body = await request.json();
    const validation = setBalanceSchema.safeParse(body);
    if (!validation.success) {
      return json(formatZodError(validation.error), 400);
    }

    const db = getDb();
    const userId = auth.user.id;
    const { actualBalanceCents } = validation.data;

    // Check cooldown — find last adjustment
    const userTransactions = await db
      .select()
      .from(transactions)
      .where(eq(transactions.userId, userId));

    const lastAdjustment = userTransactions
      .filter(
        (tx) =>
          tx.description.startsWith('[Balance Adjustment]') ||
          tx.description.startsWith('[Opening Balance]')
      )
      .sort((a, b) => b.createdAt - a.createdAt)[0];

    if (lastAdjustment && Date.now() - lastAdjustment.createdAt < COOLDOWN_MS) {
      const nextDate = new Date(lastAdjustment.createdAt + COOLDOWN_MS);
      return errorJson(
        'VALIDATION_ERROR',
        `Balance can only be adjusted once per week. Next adjustment available on ${nextDate.toLocaleDateString()}.`,
        429
      );
    }

    // Calculate current balance
    const currentBalanceCents = userTransactions.reduce(
      (sum, tx) => sum + tx.amountCents,
      0
    );

    const differenceCents = actualBalanceCents - currentBalanceCents;

    if (differenceCents === 0) {
      return NextResponse.json({
        data: {
          message: 'Balance already matches. No adjustment needed.',
          adjustmentCents: 0,
        },
      });
    }

    // Get or create account
    let [account] = await db
      .select()
      .from(accounts)
      .where(eq(accounts.userId, userId))
      .limit(1);

    if (!account) {
      const accountId = nanoid();
      await db.insert(accounts).values({
        id: accountId,
        userId,
        name: 'Cash',
        type: 'cash',
        createdAt: Date.now(),
      });
      [account] = await db
        .select()
        .from(accounts)
        .where(eq(accounts.id, accountId));
    }

    // Determine description and type
    const isFirst =
      userTransactions.filter(
        (tx) =>
          !tx.description.startsWith('[Balance Adjustment]') &&
          !tx.description.startsWith('[Opening Balance]')
      ).length === 0;

    const description = isFirst
      ? '[Opening Balance] Starting balance'
      : `[Balance Adjustment] ${differenceCents > 0 ? 'Added' : 'Removed'} ${Math.abs(differenceCents / 100).toFixed(2)} to match actual balance`;

    const type = differenceCents > 0 ? 'income' : 'expense';
    const now = Date.now();
    const today = new Date().toISOString().split('T')[0]!;

    await db.insert(transactions).values({
      id: nanoid(),
      userId,
      accountId: account!.id,
      date: today,
      description,
      amountCents: differenceCents,
      type,
      cleared: true,
      createdAt: now,
      updatedAt: now,
    });

    return NextResponse.json({
      data: {
        message: isFirst
          ? `Opening balance set to $${(actualBalanceCents / 100).toFixed(2)}.`
          : `Balance adjusted by $${(Math.abs(differenceCents) / 100).toFixed(2)}. New balance: $${(actualBalanceCents / 100).toFixed(2)}.`,
        adjustmentCents: differenceCents,
        newBalanceCents: actualBalanceCents,
        isFirst,
      },
    });
  } catch (error) {
    console.error('Failed to set balance:', error);
    return errorJson('INTERNAL_ERROR', 'Failed to set balance', 500);
  }
}
