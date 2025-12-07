import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { goals } from '@/lib/db/schema';
import { getAuthenticatedUser } from '@/lib/api/auth';
import { json, errorJson, formatZodError, idSchema, centsSchema } from '@/lib/api/utils';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ id: string }>;
}

const contributeSchema = z.object({
  amountCents: centsSchema,
});

/**
 * POST /api/v1/goals/:id/contribute - Add a contribution to a goal
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await getAuthenticatedUser(request);
    if (!auth.success) return auth.response;

    const { id } = await params;
    const idValidation = idSchema.safeParse(id);
    if (!idValidation.success) {
      return errorJson('VALIDATION_ERROR', 'Invalid goal ID', 400);
    }

    const body = await request.json();
    const validation = contributeSchema.safeParse(body);

    if (!validation.success) {
      return json(formatZodError(validation.error), 400);
    }

    const db = getDb();

    // Get the goal
    const [goal] = await db
      .select()
      .from(goals)
      .where(and(eq(goals.id, idValidation.data), eq(goals.userId, auth.user.id)));

    if (!goal) {
      return errorJson('NOT_FOUND', 'Goal not found', 404);
    }

    const previousStatus = goal.status;
    if (previousStatus !== 'active') {
      return errorJson('INVALID_STATE', 'Cannot contribute to a non-active goal', 400);
    }

    const now = Date.now();
    const newCurrentAmount = goal.currentAmountCents + validation.data.amountCents;
    const progressPercent = goal.targetAmountCents > 0
      ? (newCurrentAmount / goal.targetAmountCents) * 100
      : 0;

    // Auto-complete if reached target
    let status: 'active' | 'completed' | 'paused' | 'abandoned' = previousStatus;
    let completedAt = goal.completedAt;
    if (newCurrentAmount >= goal.targetAmountCents) {
      status = 'completed';
      completedAt = now;
    }

    await db
      .update(goals)
      .set({
        currentAmountCents: newCurrentAmount,
        progressPercent,
        status,
        completedAt,
        updatedAt: now,
      })
      .where(eq(goals.id, idValidation.data));

    const [updated] = await db
      .select()
      .from(goals)
      .where(eq(goals.id, idValidation.data));

    return NextResponse.json({
      data: updated,
      contribution: {
        amountCents: validation.data.amountCents,
        previousAmountCents: goal.currentAmountCents,
        newAmountCents: newCurrentAmount,
        goalCompleted: status === 'completed',
      },
    });
  } catch (error) {
    console.error('Failed to contribute to goal:', error);
    return errorJson('INTERNAL_ERROR', 'Failed to contribute to goal', 500);
  }
}
