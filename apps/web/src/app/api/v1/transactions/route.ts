import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { eq, desc, and, gte, lte, like } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { getDb } from '@/lib/db/client';
import { transactions } from '@/lib/db/schema';
import { getAuthenticatedUser } from '@/lib/api/auth';
import {
  json,
  errorJson,
  formatZodError,
  isoDateSchema,
  idSchema,
  centsSchema,
} from '@/lib/api/utils';

export const dynamic = 'force-dynamic';

const transactionTypeSchema = z.enum(['income', 'expense']);

const createTransactionSchema = z.object({
  date: isoDateSchema,
  description: z.string().min(1).max(500),
  amountCents: centsSchema,
  type: transactionTypeSchema,
  categoryId: idSchema.optional().nullable(),
  accountId: idSchema,
  cleared: z.boolean().optional().default(false),
  notes: z.string().max(1000).optional().nullable(),
});

/**
 * GET /api/v1/transactions - List transactions with filters
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(request);
    if (!auth.success) return auth.response;

    const db = getDb();
    const searchParams = request.nextUrl.searchParams;

    // Parse filter params (support both from/to and startDate/endDate)
    const startDate = searchParams.get('startDate') || searchParams.get('from');
    const endDate = searchParams.get('endDate') || searchParams.get('to');
    const accountId = searchParams.get('accountId');
    const categoryId = searchParams.get('categoryId');
    const type = searchParams.get('type');
    const search = searchParams.get('q');
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    // Build conditions
    const conditions = [eq(transactions.userId, auth.user.id)];

    if (startDate) {
      conditions.push(gte(transactions.date, startDate));
    }
    if (endDate) {
      conditions.push(lte(transactions.date, endDate));
    }
    if (accountId) {
      conditions.push(eq(transactions.accountId, accountId));
    }
    if (categoryId) {
      conditions.push(eq(transactions.categoryId, categoryId));
    }
    if (type && (type === 'income' || type === 'expense')) {
      conditions.push(eq(transactions.type, type));
    }
    if (search) {
      conditions.push(like(transactions.description, `%${search}%`));
    }

    const userTransactions = await db
      .select()
      .from(transactions)
      .where(and(...conditions))
      .orderBy(desc(transactions.date), desc(transactions.createdAt))
      .limit(limit);

    return NextResponse.json({ data: userTransactions });
  } catch (error) {
    console.error('Failed to list transactions:', error);
    return errorJson('INTERNAL_ERROR', 'Failed to list transactions', 500);
  }
}

/**
 * POST /api/v1/transactions - Create a new transaction
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(request);
    if (!auth.success) return auth.response;

    const body = await request.json();
    const validation = createTransactionSchema.safeParse(body);

    if (!validation.success) {
      return json(formatZodError(validation.error), 400);
    }

    const data = validation.data;
    const db = getDb();

    const id = nanoid();
    const now = Date.now();

    await db.insert(transactions).values({
      id,
      userId: auth.user.id,
      date: data.date,
      description: data.description,
      amountCents: data.amountCents,
      type: data.type,
      categoryId: data.categoryId || null,
      accountId: data.accountId,
      cleared: data.cleared,
      notes: data.notes || null,
      createdAt: now,
      updatedAt: now,
    });

    const [transaction] = await db
      .select()
      .from(transactions)
      .where(eq(transactions.id, id));

    return NextResponse.json({ data: transaction }, { status: 201 });
  } catch (error) {
    console.error('Failed to create transaction:', error);
    return errorJson('INTERNAL_ERROR', 'Failed to create transaction', 500);
  }
}
