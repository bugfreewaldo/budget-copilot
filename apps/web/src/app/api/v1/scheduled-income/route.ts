import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { eq, and, desc } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { scheduledIncome } from '@/lib/db/schema';
import { getAuthenticatedUser } from '@/lib/api/auth';
import {
  formatZodError,
  json,
  errorJson,
  centsSchema,
  idSchema,
} from '@/lib/api/utils';

export const dynamic = 'force-dynamic';

const createIncomeSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  source: z.enum([
    'salary',
    'freelance',
    'business',
    'investment',
    'rental',
    'side_hustle',
    'bonus',
    'other',
  ]),
  amountCents: centsSchema.nonnegative(),
  payDay: z.number().int().min(1).max(31),
  frequency: z.enum(['weekly', 'biweekly', 'semimonthly', 'monthly']),
  isVariable: z.boolean().optional().default(false),
  notes: z.string().optional().nullable(),
  nextPayDate: z.string().optional().nullable(),
});

const updateIncomeSchema = createIncomeSchema.partial();

/**
 * GET /api/v1/scheduled-income - List all scheduled income
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(request);
    if (!auth.success) return auth.response;

    const db = getDb();

    const result = await db
      .select()
      .from(scheduledIncome)
      .where(eq(scheduledIncome.userId, auth.user.id))
      .orderBy(desc(scheduledIncome.createdAt));

    return NextResponse.json({ data: result });
  } catch (error) {
    console.error('Failed to list scheduled income:', error);
    return errorJson('DB_ERROR', 'Failed to retrieve scheduled income', 500);
  }
}

/**
 * POST /api/v1/scheduled-income - Create a new scheduled income
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(request);
    if (!auth.success) return auth.response;

    const body = await request.json();
    const validation = createIncomeSchema.safeParse(body);

    if (!validation.success) {
      return json(formatZodError(validation.error), 400);
    }

    const db = getDb();
    const now = Date.now();
    const id = nanoid();

    await db.insert(scheduledIncome).values({
      id,
      userId: auth.user.id,
      name: validation.data.name,
      source: validation.data.source,
      amountCents: validation.data.amountCents,
      payDay: validation.data.payDay,
      frequency: validation.data.frequency,
      isVariable: validation.data.isVariable,
      notes: validation.data.notes || null,
      status: 'active',
      nextPayDate: validation.data.nextPayDate || null,
      createdAt: now,
      updatedAt: now,
    });

    const [income] = await db
      .select()
      .from(scheduledIncome)
      .where(eq(scheduledIncome.id, id));

    return NextResponse.json({ data: income }, { status: 201 });
  } catch (error) {
    console.error('Failed to create scheduled income:', error);
    return errorJson('DB_ERROR', 'Failed to create scheduled income', 500);
  }
}

/**
 * PUT /api/v1/scheduled-income - Update a scheduled income
 */
export async function PUT(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(request);
    if (!auth.success) return auth.response;

    const body = await request.json();
    const { id, ...updateData } = body;

    if (!id) {
      return errorJson('VALIDATION_ERROR', 'Income ID is required', 400);
    }

    const idValidation = idSchema.safeParse(id);
    if (!idValidation.success) {
      return errorJson('VALIDATION_ERROR', 'Invalid income ID format', 400);
    }

    const validation = updateIncomeSchema.safeParse(updateData);

    if (!validation.success) {
      return json(formatZodError(validation.error), 400);
    }

    const db = getDb();
    const now = Date.now();

    // Check if income exists and belongs to user
    const [existing] = await db
      .select()
      .from(scheduledIncome)
      .where(
        and(
          eq(scheduledIncome.id, id),
          eq(scheduledIncome.userId, auth.user.id)
        )
      );

    if (!existing) {
      return errorJson('NOT_FOUND', 'Scheduled income not found', 404);
    }

    await db
      .update(scheduledIncome)
      .set({
        ...validation.data,
        updatedAt: now,
      })
      .where(eq(scheduledIncome.id, id));

    const [updated] = await db
      .select()
      .from(scheduledIncome)
      .where(eq(scheduledIncome.id, id));

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error('Failed to update scheduled income:', error);
    return errorJson('DB_ERROR', 'Failed to update scheduled income', 500);
  }
}
