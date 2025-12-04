import { NextRequest } from 'next/server';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { and, eq, gte, lte, like } from 'drizzle-orm';
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
 * Transaction validation schemas
 */
const transactionTypeSchema = z.enum(['income', 'expense']);

const createTransactionSchema = z.object({
  date: isoDateSchema,
  description: z.string().min(1, 'Description is required').max(500),
  amountCents: centsSchema,
  type: transactionTypeSchema,
  categoryId: idSchema.optional(),
  accountId: idSchema,
  cleared: z.boolean().optional().default(false),
  notes: z.string().max(1000).optional(),
});

const listTransactionsQuerySchema = z.object({
  from: isoDateSchema.optional(),
  to: isoDateSchema.optional(),
  categoryId: idSchema.optional(),
  accountId: idSchema.optional(),
  q: z.string().optional(),
});

/**
 * GET /api/v1/transactions - List transactions with filters
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = {
      from: searchParams.get('from') || undefined,
      to: searchParams.get('to') || undefined,
      categoryId: searchParams.get('categoryId') || undefined,
      accountId: searchParams.get('accountId') || undefined,
      q: searchParams.get('q') || undefined,
    };

    const validation = listTransactionsQuerySchema.safeParse(query);
    if (!validation.success) {
      return json(formatZodError(validation.error), 400);
    }

    const db = getDb();
    const conditions = [];

    // TODO: Get userId from session
    const userId = 'test-user-00000000000000000001';
    conditions.push(eq(transactions.userId, userId));

    if (validation.data.from) {
      conditions.push(gte(transactions.date, validation.data.from));
    }
    if (validation.data.to) {
      conditions.push(lte(transactions.date, validation.data.to));
    }
    if (validation.data.categoryId) {
      conditions.push(eq(transactions.categoryId, validation.data.categoryId));
    }
    if (validation.data.accountId) {
      conditions.push(eq(transactions.accountId, validation.data.accountId));
    }
    if (validation.data.q) {
      conditions.push(like(transactions.description, `%${validation.data.q}%`));
    }

    const result = await db
      .select()
      .from(transactions)
      .where(and(...conditions))
      .orderBy(transactions.date);

    return json({ data: result });
  } catch (error) {
    console.error('Failed to list transactions:', error);
    return errorJson('DB_ERROR', 'Failed to retrieve transactions', 500, {
      error: (error as Error).message,
    });
  }
}

/**
 * POST /api/v1/transactions - Create new transaction
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validation = createTransactionSchema.safeParse(body);

    if (!validation.success) {
      return json(formatZodError(validation.error), 400);
    }

    const db = getDb();
    // TODO: Get userId from session
    const userId = 'test-user-00000000000000000001';
    const id = nanoid();
    const now = Date.now();

    await db.insert(transactions).values({
      id,
      userId,
      date: validation.data.date,
      description: validation.data.description,
      amountCents: validation.data.amountCents,
      type: validation.data.type,
      categoryId: validation.data.categoryId || null,
      accountId: validation.data.accountId,
      cleared: validation.data.cleared ?? false,
      notes: validation.data.notes || null,
      createdAt: now,
      updatedAt: now,
    });

    const [transaction] = await db
      .select()
      .from(transactions)
      .where(eq(transactions.id, id));

    return json({ data: transaction }, 201);
  } catch (error) {
    console.error('Failed to create transaction:', error);
    return errorJson('DB_ERROR', 'Failed to create transaction', 500, {
      error: (error as Error).message,
    });
  }
}
