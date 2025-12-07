import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { eq, desc } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { getDb } from '@/lib/db/client';
import { goals } from '@/lib/db/schema';
import { getAuthenticatedUser } from '@/lib/api/auth';
import { json, errorJson, formatZodError, idSchema, centsSchema } from '@/lib/api/utils';

export const dynamic = 'force-dynamic';

const createGoalSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).nullable().optional(),
  emoji: z.string().max(10).nullable().optional(),
  targetAmountCents: centsSchema,
  currentAmountCents: centsSchema.optional().default(0),
  targetDate: z.string().nullable().optional(),
  startDate: z.string().optional(),
  goalType: z.enum([
    'savings',
    'debt_payoff',
    'purchase',
    'emergency_fund',
    'investment',
    'other',
  ]),
  linkedDebtId: idSchema.nullable().optional(),
  linkedAccountId: idSchema.nullable().optional(),
});

/**
 * GET /api/v1/goals - List all goals for the user
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(request);
    if (!auth.success) return auth.response;

    const db = getDb();
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');

    const query = db
      .select()
      .from(goals)
      .where(eq(goals.userId, auth.user.id))
      .orderBy(desc(goals.createdAt));

    const userGoals = await query;

    // Filter by status in JS if specified (simpler than dynamic query building)
    const filteredGoals = status
      ? userGoals.filter((g) => g.status === status)
      : userGoals;

    // Calculate summary
    const summary = {
      totalGoals: filteredGoals.length,
      activeGoals: filteredGoals.filter((g) => g.status === 'active').length,
      completedGoals: filteredGoals.filter((g) => g.status === 'completed').length,
      totalTargetCents: filteredGoals.reduce((sum, g) => sum + g.targetAmountCents, 0),
      totalCurrentCents: filteredGoals.reduce((sum, g) => sum + g.currentAmountCents, 0),
    };

    return NextResponse.json({ data: filteredGoals, summary });
  } catch (error) {
    console.error('Failed to list goals:', error);
    return errorJson('INTERNAL_ERROR', 'Failed to list goals', 500);
  }
}

/**
 * POST /api/v1/goals - Create a new goal
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(request);
    if (!auth.success) return auth.response;

    const body = await request.json();
    const validation = createGoalSchema.safeParse(body);

    if (!validation.success) {
      return json(formatZodError(validation.error), 400);
    }

    const data = validation.data;
    const db = getDb();

    const id = nanoid();
    const now = Date.now();
    const startDateValue = data.startDate || new Date().toISOString().split('T')[0];

    // Calculate initial progress
    const progressPercent = data.targetAmountCents > 0
      ? ((data.currentAmountCents || 0) / data.targetAmountCents) * 100
      : 0;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await db.insert(goals).values({
      id,
      userId: auth.user.id,
      name: data.name,
      description: data.description || null,
      emoji: data.emoji || null,
      targetAmountCents: data.targetAmountCents,
      currentAmountCents: data.currentAmountCents || 0,
      targetDate: data.targetDate || null,
      startDate: startDateValue,
      goalType: data.goalType,
      linkedDebtId: data.linkedDebtId || null,
      linkedAccountId: data.linkedAccountId || null,
      progressPercent,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    } as any);

    const [goal] = await db.select().from(goals).where(eq(goals.id, id));

    return NextResponse.json({ data: goal }, { status: 201 });
  } catch (error) {
    console.error('Failed to create goal:', error);
    return errorJson('INTERNAL_ERROR', 'Failed to create goal', 500);
  }
}
