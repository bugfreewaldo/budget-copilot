import { NextRequest } from 'next/server';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { transactions } from '@/lib/db/schema';
import {
  isoDateSchema,
  idSchema,
  centsSchema,
  formatZodError,
  json,
  errorJson,
} from '@/lib/api/utils';

/**
 * Transaction update schema
 */
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
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const idValidation = idSchema.safeParse(id);
    if (!idValidation.success) {
      return errorJson('VALIDATION_ERROR', 'Invalid transaction ID', 400);
    }

    const db = getDb();
    const [transaction] = await db
      .select()
      .from(transactions)
      .where(eq(transactions.id, idValidation.data));

    if (!transaction) {
      return errorJson('NOT_FOUND', 'Transaction not found', 404);
    }

    return json({ data: transaction });
  } catch (error) {
    console.error('Failed to get transaction:', error);
    return errorJson('DB_ERROR', 'Failed to retrieve transaction', 500, {
      error: (error as Error).message,
    });
  }
}

/**
 * PATCH /api/v1/transactions/:id - Update transaction
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
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

    // Check if transaction exists
    const [existing] = await db
      .select()
      .from(transactions)
      .where(eq(transactions.id, idValidation.data));

    if (!existing) {
      return errorJson('NOT_FOUND', 'Transaction not found', 404);
    }

    await db
      .update(transactions)
      .set({
        ...validation.data,
        updatedAt: Date.now(),
      })
      .where(eq(transactions.id, idValidation.data));

    const [updated] = await db
      .select()
      .from(transactions)
      .where(eq(transactions.id, idValidation.data));

    return json({ data: updated });
  } catch (error) {
    console.error('Failed to update transaction:', error);
    return errorJson('DB_ERROR', 'Failed to update transaction', 500, {
      error: (error as Error).message,
    });
  }
}

/**
 * DELETE /api/v1/transactions/:id - Delete transaction
 */
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const idValidation = idSchema.safeParse(id);
    if (!idValidation.success) {
      return errorJson('VALIDATION_ERROR', 'Invalid transaction ID', 400);
    }

    const db = getDb();

    // Check if transaction exists
    const [existing] = await db
      .select()
      .from(transactions)
      .where(eq(transactions.id, idValidation.data));

    if (!existing) {
      return errorJson('NOT_FOUND', 'Transaction not found', 404);
    }

    await db.delete(transactions).where(eq(transactions.id, idValidation.data));

    return new Response(null, { status: 204 });
  } catch (error) {
    console.error('Failed to delete transaction:', error);
    return errorJson('DB_ERROR', 'Failed to delete transaction', 500, {
      error: (error as Error).message,
    });
  }
}
