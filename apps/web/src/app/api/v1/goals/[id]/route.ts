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

const updateGoalSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).nullable().optional(),
  emoji: z.string().max(10).nullable().optional(),
  targetAmountCents: centsSchema.optional(),
  currentAmountCents: centsSchema.optional(),
  targetDate: z.string().nullable().optional(),
  goalType: z.enum([
    'savings',
    'debt_payoff',
    'purchase',
    'emergency_fund',
    'investment',
    'other',
  ]).optional(),
  linkedDebtId: idSchema.nullable().optional(),
  linkedAccountId: idSchema.nullable().optional(),
  status: z.enum(['active', 'completed', 'paused', 'abandoned']).optional(),
});

/**
 * GET /api/v1/goals/:id - Get a single goal
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await getAuthenticatedUser(request);
    if (!auth.success) return auth.response;

    const { id } = await params;
    const idValidation = idSchema.safeParse(id);
    if (!idValidation.success) {
      return errorJson('VALIDATION_ERROR', 'Invalid goal ID', 400);
    }

    const db = getDb();
    const [goal] = await db
      .select()
      .from(goals)
      .where(and(eq(goals.id, idValidation.data), eq(goals.userId, auth.user.id)));

    if (!goal) {
      return errorJson('NOT_FOUND', 'Goal not found', 404);
    }

    return NextResponse.json({ data: goal });
  } catch (error) {
    console.error('Failed to get goal:', error);
    return errorJson('INTERNAL_ERROR', 'Failed to get goal', 500);
  }
}

/**
 * PATCH /api/v1/goals/:id - Update a goal
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await getAuthenticatedUser(request);
    if (!auth.success) return auth.response;

    const { id } = await params;
    const idValidation = idSchema.safeParse(id);
    if (!idValidation.success) {
      return errorJson('VALIDATION_ERROR', 'Invalid goal ID', 400);
    }

    const body = await request.json();
    const validation = updateGoalSchema.safeParse(body);

    if (!validation.success) {
      return json(formatZodError(validation.error), 400);
    }

    const db = getDb();

    // Check if goal exists and belongs to user
    const [existing] = await db
      .select()
      .from(goals)
      .where(and(eq(goals.id, idValidation.data), eq(goals.userId, auth.user.id)));

    if (!existing) {
      return errorJson('NOT_FOUND', 'Goal not found', 404);
    }

    const data = validation.data;
    const now = Date.now();

    // Calculate new progress if amounts changed
    const targetAmount = data.targetAmountCents ?? existing.targetAmountCents;
    const currentAmount = data.currentAmountCents ?? existing.currentAmountCents;
    const progressPercent = targetAmount > 0 ? (currentAmount / targetAmount) * 100 : 0;

    // Auto-complete if reached 100%
    let status = data.status ?? existing.status;
    let completedAt = existing.completedAt;
    if (progressPercent >= 100 && status === 'active') {
      status = 'completed';
      completedAt = now;
    }

    await db
      .update(goals)
      .set({
        ...data,
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

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error('Failed to update goal:', error);
    return errorJson('INTERNAL_ERROR', 'Failed to update goal', 500);
  }
}

/**
 * DELETE /api/v1/goals/:id - Delete a goal
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await getAuthenticatedUser(request);
    if (!auth.success) return auth.response;

    const { id } = await params;
    const idValidation = idSchema.safeParse(id);
    if (!idValidation.success) {
      return errorJson('VALIDATION_ERROR', 'Invalid goal ID', 400);
    }

    const db = getDb();

    const [existing] = await db
      .select()
      .from(goals)
      .where(and(eq(goals.id, idValidation.data), eq(goals.userId, auth.user.id)));

    if (!existing) {
      return errorJson('NOT_FOUND', 'Goal not found', 404);
    }

    await db
      .delete(goals)
      .where(and(eq(goals.id, idValidation.data), eq(goals.userId, auth.user.id)));

    return new Response(null, { status: 204 });
  } catch (error) {
    console.error('Failed to delete goal:', error);
    return errorJson('DB_ERROR', 'Failed to delete goal', 500);
  }
}
