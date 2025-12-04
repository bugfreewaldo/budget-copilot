import { and, eq, gte, lt } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import type { DatabaseInstance } from '../../../db/client.js';
import { envelopes, transactions } from '../../../db/schema.js';
import type { CreateEnvelopeInput } from '../../schemas/envelopes.js';

/**
 * Envelope repository
 * Data access layer for envelopes table
 */

export async function findEnvelopesByMonth(
  db: DatabaseInstance,
  month: string,
  userId?: string
) {
  if (userId) {
    return await db
      .select()
      .from(envelopes)
      .where(and(eq(envelopes.month, month), eq(envelopes.userId, userId)));
  }
  return await db.select().from(envelopes).where(eq(envelopes.month, month));
}

export async function findEnvelopeById(
  db: DatabaseInstance,
  id: string
) {
  const result = await db.select().from(envelopes).where(eq(envelopes.id, id));
  return result[0];
}

export async function findEnvelopeByCategoryMonth(
  db: DatabaseInstance,
  categoryId: string,
  month: string
) {
  const result = await db
    .select()
    .from(envelopes)
    .where(
      and(eq(envelopes.categoryId, categoryId), eq(envelopes.month, month))
    );
  return result[0];
}

export async function upsertEnvelope(
  db: DatabaseInstance,
  input: CreateEnvelopeInput & { userId: string }
) {
  // Check if envelope exists
  const existing = await findEnvelopeByCategoryMonth(
    db,
    input.categoryId,
    input.month
  );

  if (existing) {
    // Update existing
    await db
      .update(envelopes)
      .set({ budgetCents: input.budgetCents })
      .where(eq(envelopes.id, existing.id));

    return await findEnvelopeById(db, existing.id);
  } else {
    // Create new
    const id = nanoid();

    await db.insert(envelopes).values({
      id,
      userId: input.userId,
      categoryId: input.categoryId,
      month: input.month,
      budgetCents: input.budgetCents,
      createdAt: Date.now(),
    });

    return await findEnvelopeById(db, id);
  }
}

/**
 * Calculate spending for an envelope based on transactions
 * Returns negative spending (expenses)
 */
export async function calculateEnvelopeSpending(
  db: DatabaseInstance,
  categoryId: string,
  month: string
): Promise<number> {
  // Parse month to get date range (e.g., "2024-01" -> 2024-01-01 to 2024-02-01)
  const [year, monthNum] = month.split('-').map(Number);
  const startDate = `${year}-${String(monthNum).padStart(2, '0')}-01`;

  // Calculate end date (first day of next month)
  const nextMonth = monthNum === 12 ? 1 : monthNum + 1;
  const nextYear = monthNum === 12 ? year + 1 : year;
  const endDate = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;

  // Get all transactions for this category in this month
  const results = await db
    .select()
    .from(transactions)
    .where(
      and(
        eq(transactions.categoryId, categoryId),
        gte(transactions.date, startDate),
        lt(transactions.date, endDate)
      )
    );

  // Sum up expense transactions (amountCents is negative for expenses)
  const totalSpent = results.reduce((sum, txn) => {
    if (txn.type === 'expense') {
      return sum + Math.abs(txn.amountCents);
    }
    return sum;
  }, 0);

  return totalSpent;
}
