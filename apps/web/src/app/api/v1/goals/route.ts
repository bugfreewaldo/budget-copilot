import { NextRequest } from 'next/server';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { and, eq, desc } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { goals } from '@/lib/db/schema';
import {
  formatZodError,
  json,
  errorJson,
  idSchema,
  isoDateSchema,
} from '@/lib/api/utils';

/**
 * Goal validation schemas
 */
const goalTypeSchema = z.enum([
  'savings',
  'debt_payoff',
  'purchase',
  'emergency_fund',
  'investment',
  'other',
]);

const goalStatusSchema = z.enum(['active', 'completed', 'paused', 'abandoned']);

const createGoalSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  description: z.string().max(500).optional(),
  emoji: z.string().max(10).optional(),
  target_amount_cents: z.number().int().positive(),
  current_amount_cents: z.number().int().min(0).optional().default(0),
  target_date: isoDateSchema.optional(),
  goal_type: goalTypeSchema,
  linked_debt_id: idSchema.optional().nullable(),
  linked_account_id: idSchema.optional().nullable(),
});

const listGoalsQuerySchema = z.object({
  cursor: idSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  status: goalStatusSchema.optional(),
  type: goalTypeSchema.optional(),
});

/**
 * Calculate goal metrics
 */
function calculateGoalMetrics(goal: {
  targetAmountCents: number;
  currentAmountCents: number;
  targetDate: string | null;
  startDate: string;
}) {
  const progressPercent =
    goal.targetAmountCents > 0
      ? Math.min(
          100,
          Math.round((goal.currentAmountCents / goal.targetAmountCents) * 100)
        )
      : 0;

  let onTrack = true;
  let projectedCompletionDate: string | null = null;
  let recommendedMonthlyCents: number | null = null;

  if (goal.targetDate && goal.currentAmountCents < goal.targetAmountCents) {
    const now = new Date();
    const target = new Date(goal.targetDate);
    const start = new Date(goal.startDate);

    // Calculate expected progress at this point
    const totalDays = Math.max(
      1,
      (target.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
    );
    const elapsedDays = Math.max(
      0,
      (now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
    );
    const expectedProgress = Math.min(1, elapsedDays / totalDays);
    const actualProgress = goal.currentAmountCents / goal.targetAmountCents;

    onTrack = actualProgress >= expectedProgress * 0.9; // 10% tolerance

    // Calculate remaining and monthly recommendation
    const remaining = goal.targetAmountCents - goal.currentAmountCents;
    const monthsRemaining = Math.max(
      1,
      (target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 30)
    );
    recommendedMonthlyCents = Math.ceil(remaining / monthsRemaining);

    // Project completion date based on current rate
    if (goal.currentAmountCents > 0 && elapsedDays > 0) {
      const dailyRate = goal.currentAmountCents / elapsedDays;
      const daysToComplete = remaining / dailyRate;
      const projected = new Date(
        now.getTime() + daysToComplete * 24 * 60 * 60 * 1000
      );
      projectedCompletionDate = projected.toISOString().split('T')[0] ?? null;
    }
  }

  return {
    progressPercent,
    onTrack,
    projectedCompletionDate,
    recommendedMonthlyCents,
  };
}

/**
 * GET /api/v1/goals - List goals with summary
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = {
      cursor: searchParams.get('cursor') || undefined,
      limit: searchParams.get('limit') || undefined,
      status: searchParams.get('status') || undefined,
      type: searchParams.get('type') || undefined,
    };

    const validation = listGoalsQuerySchema.safeParse(query);
    if (!validation.success) {
      return json(formatZodError(validation.error), 400);
    }

    const db = getDb();
    const userId = 'test-user-00000000000000000001';
    const conditions = [eq(goals.userId, userId)];

    if (validation.data.status) {
      conditions.push(eq(goals.status, validation.data.status));
    }
    if (validation.data.type) {
      conditions.push(eq(goals.goalType, validation.data.type));
    }

    const result = await db
      .select()
      .from(goals)
      .where(and(...conditions))
      .orderBy(desc(goals.createdAt))
      .limit(validation.data.limit);

    // Calculate summary
    const activeGoals = result.filter((g) => g.status === 'active');
    const totalTarget = activeGoals.reduce(
      (sum, g) => sum + g.targetAmountCents,
      0
    );
    const totalCurrent = activeGoals.reduce(
      (sum, g) => sum + g.currentAmountCents,
      0
    );
    const onTrackCount = activeGoals.filter((g) => g.onTrack).length;

    const summary = {
      activeCount: activeGoals.length,
      totalTargetCents: totalTarget,
      totalCurrentCents: totalCurrent,
      overallProgressPercent:
        totalTarget > 0 ? Math.round((totalCurrent / totalTarget) * 100) : 0,
      onTrackCount,
    };

    return json({
      data: result,
      summary,
      nextCursor: null,
      count: result.length,
    });
  } catch (error) {
    console.error('Failed to list goals:', error);
    return errorJson('DB_ERROR', 'Failed to retrieve goals', 500, {
      error: (error as Error).message,
    });
  }
}

/**
 * POST /api/v1/goals - Create new goal
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validation = createGoalSchema.safeParse(body);

    if (!validation.success) {
      return json(formatZodError(validation.error), 400);
    }

    const db = getDb();
    const userId = 'test-user-00000000000000000001';
    const id = nanoid();
    const now = Date.now();
    const today = new Date().toISOString().split('T')[0]!;

    const metrics = calculateGoalMetrics({
      targetAmountCents: validation.data.target_amount_cents,
      currentAmountCents: validation.data.current_amount_cents ?? 0,
      targetDate: validation.data.target_date ?? null,
      startDate: today,
    });

    await db.insert(goals).values({
      id,
      userId,
      name: validation.data.name,
      description: validation.data.description || null,
      emoji: validation.data.emoji || null,
      targetAmountCents: validation.data.target_amount_cents,
      currentAmountCents: validation.data.current_amount_cents ?? 0,
      targetDate: validation.data.target_date || null,
      startDate: today,
      goalType: validation.data.goal_type,
      linkedDebtId: validation.data.linked_debt_id || null,
      linkedAccountId: validation.data.linked_account_id || null,
      progressPercent: metrics.progressPercent,
      onTrack: metrics.onTrack,
      projectedCompletionDate: metrics.projectedCompletionDate,
      recommendedMonthlyCents: metrics.recommendedMonthlyCents,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    });

    const [goal] = await db.select().from(goals).where(eq(goals.id, id));

    return json({ data: goal }, 201);
  } catch (error) {
    console.error('Failed to create goal:', error);
    return errorJson('DB_ERROR', 'Failed to create goal', 500, {
      error: (error as Error).message,
    });
  }
}
