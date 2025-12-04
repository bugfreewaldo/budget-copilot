import { NextRequest } from 'next/server';
import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { goals } from '@/lib/db/schema';
import { formatZodError, json, errorJson } from '@/lib/api/utils';

const contributeSchema = z.object({
  amount_cents: z.number().int().positive(),
});

type RouteContext = { params: Promise<{ id: string }> };

/**
 * POST /api/v1/goals/[id]/contribute - Add contribution to goal
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const validation = contributeSchema.safeParse(body);

    if (!validation.success) {
      return json(formatZodError(validation.error), 400);
    }

    const db = getDb();
    const userId = 'test-user-00000000000000000001';

    const [goal] = await db
      .select()
      .from(goals)
      .where(and(eq(goals.id, id), eq(goals.userId, userId)));

    if (!goal) {
      return errorJson('NOT_FOUND', 'Goal not found', 404);
    }

    const newAmount = goal.currentAmountCents + validation.data.amount_cents;
    const isCompleted = newAmount >= goal.targetAmountCents;
    const newProgress = Math.min(
      100,
      Math.round((newAmount / goal.targetAmountCents) * 100)
    );

    const updates: Record<string, unknown> = {
      currentAmountCents: newAmount,
      progressPercent: newProgress,
      updatedAt: Date.now(),
    };

    if (isCompleted) {
      updates.status = 'completed';
      updates.completedAt = Date.now();
    }

    await db.update(goals).set(updates).where(eq(goals.id, id));

    const [updated] = await db.select().from(goals).where(eq(goals.id, id));

    return json({
      data: updated,
      contribution: {
        amountCents: validation.data.amount_cents,
        newTotalCents: newAmount,
        isCompleted,
      },
    });
  } catch (error) {
    console.error('Failed to contribute to goal:', error);
    return errorJson('DB_ERROR', 'Failed to contribute to goal', 500, {
      error: (error as Error).message,
    });
  }
}
