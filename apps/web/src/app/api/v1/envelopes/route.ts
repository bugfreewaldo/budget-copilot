import { NextRequest } from 'next/server';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { eq, and, gte, lte, sql } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { envelopes, transactions } from '@/lib/db/schema';
import {
  idSchema,
  monthSchema,
  centsSchema,
  formatZodError,
  json,
  errorJson,
} from '@/lib/api/utils';

/**
 * Envelope validation schemas
 */
const createEnvelopeSchema = z.object({
  categoryId: idSchema,
  month: monthSchema,
  budgetCents: centsSchema.nonnegative(),
});

const listEnvelopesQuerySchema = z.object({
  month: monthSchema,
});

/**
 * Calculate spending for an envelope
 */
async function calculateEnvelopeSpending(
  db: ReturnType<typeof getDb>,
  categoryId: string,
  month: string
): Promise<number> {
  const startDate = `${month}-01`;
  const endDate = `${month}-31`;

  const result = await db
    .select({
      total: sql<number>`COALESCE(SUM(ABS(${transactions.amountCents})), 0)`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.categoryId, categoryId),
        eq(transactions.type, 'expense'),
        gte(transactions.date, startDate),
        lte(transactions.date, endDate)
      )
    );

  return result[0]?.total ?? 0;
}

/**
 * GET /api/v1/envelopes - List envelopes for a month with spending
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = {
      month: searchParams.get('month') || undefined,
    };

    const validation = listEnvelopesQuerySchema.safeParse(query);
    if (!validation.success) {
      return json(formatZodError(validation.error), 400);
    }

    const db = getDb();
    // TODO: Get userId from session
    const userId = 'test-user-00000000000000000001';

    const result = await db
      .select()
      .from(envelopes)
      .where(
        and(
          eq(envelopes.userId, userId),
          eq(envelopes.month, validation.data.month)
        )
      );

    // Calculate spending for each envelope
    const envelopesWithSpending = await Promise.all(
      result.map(async (envelope) => {
        const spentCents = await calculateEnvelopeSpending(
          db,
          envelope.categoryId,
          envelope.month
        );

        return {
          ...envelope,
          spentCents,
          remainingCents: envelope.budgetCents - spentCents,
        };
      })
    );

    return json({ data: envelopesWithSpending });
  } catch (error) {
    console.error('Failed to list envelopes:', error);
    return errorJson('DB_ERROR', 'Failed to retrieve envelopes', 500, {
      error: (error as Error).message,
    });
  }
}

/**
 * POST /api/v1/envelopes - Create or update envelope (upsert)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validation = createEnvelopeSchema.safeParse(body);

    if (!validation.success) {
      return json(formatZodError(validation.error), 400);
    }

    const db = getDb();
    // TODO: Get userId from session
    const userId = 'test-user-00000000000000000001';
    const now = Date.now();

    // Check if envelope already exists for this category/month
    const [existing] = await db
      .select()
      .from(envelopes)
      .where(
        and(
          eq(envelopes.userId, userId),
          eq(envelopes.categoryId, validation.data.categoryId),
          eq(envelopes.month, validation.data.month)
        )
      );

    let envelope;
    if (existing) {
      // Update existing envelope
      await db
        .update(envelopes)
        .set({
          budgetCents: validation.data.budgetCents,
        })
        .where(eq(envelopes.id, existing.id));

      [envelope] = await db
        .select()
        .from(envelopes)
        .where(eq(envelopes.id, existing.id));
    } else {
      // Create new envelope
      const id = nanoid();
      await db.insert(envelopes).values({
        id,
        userId,
        categoryId: validation.data.categoryId,
        month: validation.data.month,
        budgetCents: validation.data.budgetCents,
        spentCents: 0,
        createdAt: now,
      });

      [envelope] = await db
        .select()
        .from(envelopes)
        .where(eq(envelopes.id, id));
    }

    return json({ data: envelope }, 201);
  } catch (error) {
    console.error('Failed to upsert envelope:', error);
    return errorJson('DB_ERROR', 'Failed to create/update envelope', 500, {
      error: (error as Error).message,
    });
  }
}
