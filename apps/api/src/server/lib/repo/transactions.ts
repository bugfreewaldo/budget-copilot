import { and, eq, gte, lte, like } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { nanoid } from 'nanoid';
import type * as schema from '../../../db/schema.js';
import { transactions } from '../../../db/schema.js';
import type {
  CreateTransactionInput,
  UpdateTransactionInput,
  ListTransactionsQuery,
} from '../../schemas/transactions.js';

/**
 * Transaction repository
 * Data access layer for transactions table
 */

export async function findAllTransactions(
  db: BetterSQLite3Database<typeof schema>,
  query: ListTransactionsQuery & { userId?: string }
) {
  const conditions = [];

  if (query.userId) {
    conditions.push(eq(transactions.userId, query.userId));
  }
  if (query.from) {
    conditions.push(gte(transactions.date, query.from));
  }
  if (query.to) {
    conditions.push(lte(transactions.date, query.to));
  }
  if (query.categoryId) {
    conditions.push(eq(transactions.categoryId, query.categoryId));
  }
  if (query.accountId) {
    conditions.push(eq(transactions.accountId, query.accountId));
  }
  if (query.q) {
    conditions.push(like(transactions.description, `%${query.q}%`));
  }

  if (conditions.length > 0) {
    return await db
      .select()
      .from(transactions)
      .where(and(...conditions))
      .orderBy(transactions.date);
  }

  return await db.select().from(transactions).orderBy(transactions.date);
}

export async function findTransactionById(
  db: BetterSQLite3Database<typeof schema>,
  id: string
) {
  const result = await db
    .select()
    .from(transactions)
    .where(eq(transactions.id, id));
  return result[0];
}

export async function createTransaction(
  db: BetterSQLite3Database<typeof schema>,
  input: CreateTransactionInput & { userId: string }
) {
  const id = nanoid();
  const now = Date.now();

  await db.insert(transactions).values({
    id,
    userId: input.userId,
    date: input.date,
    description: input.description,
    amountCents: input.amountCents,
    type: input.type,
    categoryId: input.categoryId || null,
    accountId: input.accountId,
    cleared: input.cleared ?? false,
    notes: input.notes || null,
    createdAt: now,
    updatedAt: now,
  });

  return await findTransactionById(db, id);
}

export async function updateTransaction(
  db: BetterSQLite3Database<typeof schema>,
  id: string,
  input: UpdateTransactionInput
) {
  const now = Date.now();

  await db
    .update(transactions)
    .set({
      ...input,
      updatedAt: now,
    })
    .where(eq(transactions.id, id));

  return await findTransactionById(db, id);
}

export async function deleteTransaction(
  db: BetterSQLite3Database<typeof schema>,
  id: string
) {
  await db.delete(transactions).where(eq(transactions.id, id));
}
