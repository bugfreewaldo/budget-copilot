import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { getDb } from '@/lib/db/client';
import { envelopes } from '@/lib/db/schema';
import { getAuthenticatedUser } from '@/lib/api/auth';
import {
  json,
  errorJson,
  formatZodError,
  idSchema,
  centsSchema,
  monthSchema,
} from '@/lib/api/utils';

export const dynamic = 'force-dynamic';

const createEnvelopeSchema = z.object({
  categoryId: idSchema,
  month: monthSchema,
  budgetCents: centsSchema,
});

/**
 * GET /api/v1/envelopes - List envelopes for a month
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(request);
    if (!auth.success) return auth.response;

    const db = getDb();
    const searchParams = request.nextUrl.searchParams;
    const month = searchParams.get('month');

    const conditions = [eq(envelopes.userId, auth.user.id)];
    if (month) {
      conditions.push(eq(envelopes.month, month));
    }

    const userEnvelopes = await db
      .select()
      .from(envelopes)
      .where(and(...conditions));

    return NextResponse.json({ data: userEnvelopes });
  } catch (error) {
    console.error('Failed to list envelopes:', error);
    return errorJson('INTERNAL_ERROR', 'Failed to list envelopes', 500);
  }
}

/**
 * POST /api/v1/envelopes - Create or update envelope
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(request);
    if (!auth.success) return auth.response;

    const body = await request.json();
    const validation = createEnvelopeSchema.safeParse(body);

    if (!validation.success) {
      return json(formatZodError(validation.error), 400);
    }

    const data = validation.data;
    const db = getDb();

    // Check if envelope already exists for this category/month
    const [existing] = await db
      .select()
      .from(envelopes)
      .where(
        and(
          eq(envelopes.userId, auth.user.id),
          eq(envelopes.categoryId, data.categoryId),
          eq(envelopes.month, data.month)
        )
      );

    if (existing) {
      // Update existing envelope
      await db
        .update(envelopes)
        .set({ budgetCents: data.budgetCents })
        .where(eq(envelopes.id, existing.id));

      const [updated] = await db
        .select()
        .from(envelopes)
        .where(eq(envelopes.id, existing.id));

      return NextResponse.json({ data: updated });
    }

    // Create new envelope
    const id = nanoid();
    const now = Date.now();

    await db.insert(envelopes).values({
      id,
      userId: auth.user.id,
      categoryId: data.categoryId,
      month: data.month,
      budgetCents: data.budgetCents,
      spentCents: 0,
      createdAt: now,
    });

    const [envelope] = await db
      .select()
      .from(envelopes)
      .where(eq(envelopes.id, id));

    return NextResponse.json({ data: envelope }, { status: 201 });
  } catch (error) {
    console.error('Failed to create/update envelope:', error);
    return errorJson('INTERNAL_ERROR', 'Failed to create/update envelope', 500);
  }
}
