import { NextRequest } from 'next/server';
import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { goals } from '@/lib/db/schema';
import {
  formatZodError,
  json,
  errorJson,
  isoDateSchema,
} from '@/lib/api/utils';

const goalStatusSchema = z.enum(['active', 'completed', 'paused', 'abandoned']);

const updateGoalSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  emoji: z.string().max(10).optional(),
  target_amount_cents: z.number().int().positive().optional(),
  current_amount_cents: z.number().int().min(0).optional(),
  target_date: isoDateSchema.nullable().optional(),
  status: goalStatusSchema.optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/v1/goals/[id] - Get single goal
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const db = getDb();
    const userId = 'test-user-00000000000000000001';

    const [goal] = await db
      .select()
      .from(goals)
      .where(and(eq(goals.id, id), eq(goals.userId, userId)));

    if (!goal) {
      return errorJson('NOT_FOUND', 'Goal not found', 404);
    }

    return json({ data: goal });
  } catch (error) {
    console.error('Failed to get goal:', error);
    return errorJson('DB_ERROR', 'Failed to retrieve goal', 500, {
      error: (error as Error).message,
    });
  }
}

/**
 * PATCH /api/v1/goals/[id] - Update goal
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const validation = updateGoalSchema.safeParse(body);

    if (!validation.success) {
      return json(formatZodError(validation.error), 400);
    }

    const db = getDb();
    const userId = 'test-user-00000000000000000001';

    const [existing] = await db
      .select()
      .from(goals)
      .where(and(eq(goals.id, id), eq(goals.userId, userId)));

    if (!existing) {
      return errorJson('NOT_FOUND', 'Goal not found', 404);
    }

    const updates: Record<string, unknown> = { updatedAt: Date.now() };

    if (validation.data.name !== undefined) {
      updates.name = validation.data.name;
    }
    if (validation.data.description !== undefined) {
      updates.description = validation.data.description;
    }
    if (validation.data.emoji !== undefined) {
      updates.emoji = validation.data.emoji;
    }
    if (validation.data.target_amount_cents !== undefined) {
      updates.targetAmountCents = validation.data.target_amount_cents;
    }
    if (validation.data.current_amount_cents !== undefined) {
      updates.currentAmountCents = validation.data.current_amount_cents;
      // Recalculate progress
      const target =
        validation.data.target_amount_cents ?? existing.targetAmountCents;
      updates.progressPercent = Math.min(
        100,
        Math.round((validation.data.current_amount_cents / target) * 100)
      );
    }
    if (validation.data.target_date !== undefined) {
      updates.targetDate = validation.data.target_date;
    }
    if (validation.data.status !== undefined) {
      updates.status = validation.data.status;
      if (validation.data.status === 'completed') {
        updates.completedAt = Date.now();
      }
    }

    await db.update(goals).set(updates).where(eq(goals.id, id));

    const [updated] = await db.select().from(goals).where(eq(goals.id, id));

    return json({ data: updated });
  } catch (error) {
    console.error('Failed to update goal:', error);
    return errorJson('DB_ERROR', 'Failed to update goal', 500, {
      error: (error as Error).message,
    });
  }
}

/**
 * DELETE /api/v1/goals/[id] - Delete goal
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const db = getDb();
    const userId = 'test-user-00000000000000000001';

    const [existing] = await db
      .select()
      .from(goals)
      .where(and(eq(goals.id, id), eq(goals.userId, userId)));

    if (!existing) {
      return errorJson('NOT_FOUND', 'Goal not found', 404);
    }

    await db.delete(goals).where(eq(goals.id, id));

    return new Response(null, { status: 204 });
  } catch (error) {
    console.error('Failed to delete goal:', error);
    return errorJson('DB_ERROR', 'Failed to delete goal', 500, {
      error: (error as Error).message,
    });
  }
}
