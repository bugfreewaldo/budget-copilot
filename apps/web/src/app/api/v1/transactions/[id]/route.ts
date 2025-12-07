import { NextRequest } from 'next/server';
import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { transactions } from '@/lib/db/schema';
import { getAuthenticatedUser } from '@/lib/api/auth';
import {
  isoDateSchema,
  idSchema,
  centsSchema,
  formatZodError,
  json,
  errorJson,
} from '@/lib/api/utils';

const transactionTypeSchema = z.enum(['income', 'expense']);

const updateTransactionSchema = z
  .object({
    date: isoDateSchema,
    description: z.string().min(1).max(500),
    amountCents: centsSchema,
    type: transactionTypeSchema,
    categoryId: idSchema.optional().nullable(),
    accountId: idSchema,
    cleared: z.boolean(),
    notes: z.string().max(1000).optional().nullable(),
  })
  .partial();

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/v1/transactions/:id - Get transaction by ID
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await getAuthenticatedUser(request);
    if (!auth.success) return auth.response;

    const { id } = await params;
    const idValidation = idSchema.safeParse(id);
    if (!idValidation.success) {
      return errorJson('VALIDATION_ERROR', 'Invalid transaction ID', 400);
    }

    const db = getDb();
    const [transaction] = await db
      .select()
      .from(transactions)
      .where(
        and(
          eq(transactions.id, idValidation.data),
          eq(transactions.userId, auth.user.id)
        )
      );

    if (!transaction) {
      return errorJson('NOT_FOUND', 'Transaction not found', 404);
    }

    return json({ data: transaction });
  } catch (error) {
    console.error('Failed to get transaction:', error);
    return errorJson('DB_ERROR', 'Failed to retrieve transaction', 500);
  }
}

/**
 * PATCH /api/v1/transactions/:id - Update transaction
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await getAuthenticatedUser(request);
    if (!auth.success) return auth.response;

    const { id } = await params;
    const idValidation = idSchema.safeParse(id);
    if (!idValidation.success) {
      return errorJson('VALIDATION_ERROR', 'Invalid transaction ID', 400);
    }

    const body = await request.json();
    const validation = updateTransactionSchema.safeParse(body);
    if (!validation.success) {
      return json(formatZodError(validation.error), 400);
    }

    const db = getDb();

    const [existing] = await db
      .select()
      .from(transactions)
      .where(
        and(
          eq(transactions.id, idValidation.data),
          eq(transactions.userId, auth.user.id)
        )
      );

    if (!existing) {
      return errorJson('NOT_FOUND', 'Transaction not found', 404);
    }

    await db
      .update(transactions)
      .set({
        ...validation.data,
        updatedAt: Date.now(),
      })
      .where(
        and(
          eq(transactions.id, idValidation.data),
          eq(transactions.userId, auth.user.id)
        )
      );

    const [updated] = await db
      .select()
      .from(transactions)
      .where(eq(transactions.id, idValidation.data));

    return json({ data: updated });
  } catch (error) {
    console.error('Failed to update transaction:', error);
    return errorJson('DB_ERROR', 'Failed to update transaction', 500);
  }
}

/**
 * DELETE /api/v1/transactions/:id - Delete transaction
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await getAuthenticatedUser(request);
    if (!auth.success) return auth.response;

    const { id } = await params;
    const idValidation = idSchema.safeParse(id);
    if (!idValidation.success) {
      return errorJson('VALIDATION_ERROR', 'Invalid transaction ID', 400);
    }

    const db = getDb();

    const [existing] = await db
      .select()
      .from(transactions)
      .where(
        and(
          eq(transactions.id, idValidation.data),
          eq(transactions.userId, auth.user.id)
        )
      );

    if (!existing) {
      return errorJson('NOT_FOUND', 'Transaction not found', 404);
    }

    await db
      .delete(transactions)
      .where(
        and(
          eq(transactions.id, idValidation.data),
          eq(transactions.userId, auth.user.id)
        )
      );

    return new Response(null, { status: 204 });
  } catch (error) {
    console.error('Failed to delete transaction:', error);
    return errorJson('DB_ERROR', 'Failed to delete transaction', 500);
  }
}
