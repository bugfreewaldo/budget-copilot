import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { eq, and, desc } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { scheduledBills } from '@/lib/db/schema';
import { getAuthenticatedUser } from '@/lib/api/auth';
import {
  formatZodError,
  json,
  errorJson,
  centsSchema,
  idSchema,
} from '@/lib/api/utils';

export const dynamic = 'force-dynamic';

const createBillSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  type: z.enum([
    'mortgage',
    'rent',
    'auto_loan',
    'credit_card',
    'personal_loan',
    'student_loan',
    'utility',
    'insurance',
    'subscription',
    'other',
  ]),
  amountCents: centsSchema.nonnegative(),
  dueDay: z.number().int().min(1).max(31),
  frequency: z.enum(['weekly', 'biweekly', 'monthly', 'quarterly', 'annually']),
  autoPay: z.boolean().optional().default(false),
  notes: z.string().optional().nullable(),
  nextDueDate: z.string().optional().nullable(),
});

const updateBillSchema = createBillSchema.partial();

/**
 * GET /api/v1/scheduled-bills - List all scheduled bills
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(request);
    if (!auth.success) return auth.response;

    const db = getDb();

    const result = await db
      .select()
      .from(scheduledBills)
      .where(eq(scheduledBills.userId, auth.user.id))
      .orderBy(desc(scheduledBills.createdAt));

    return NextResponse.json({ data: result });
  } catch (error) {
    console.error('Failed to list scheduled bills:', error);
    return errorJson('DB_ERROR', 'Failed to retrieve scheduled bills', 500);
  }
}

/**
 * POST /api/v1/scheduled-bills - Create a new scheduled bill
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(request);
    if (!auth.success) return auth.response;

    const body = await request.json();
    const validation = createBillSchema.safeParse(body);

    if (!validation.success) {
      return json(formatZodError(validation.error), 400);
    }

    const db = getDb();
    const now = Date.now();
    const id = nanoid();

    await db.insert(scheduledBills).values({
      id,
      userId: auth.user.id,
      name: validation.data.name,
      type: validation.data.type,
      amountCents: validation.data.amountCents,
      dueDay: validation.data.dueDay,
      frequency: validation.data.frequency,
      autoPay: validation.data.autoPay,
      notes: validation.data.notes || null,
      status: 'active',
      nextDueDate: validation.data.nextDueDate || null,
      createdAt: now,
      updatedAt: now,
    });

    const [bill] = await db
      .select()
      .from(scheduledBills)
      .where(eq(scheduledBills.id, id));

    return NextResponse.json({ data: bill }, { status: 201 });
  } catch (error) {
    console.error('Failed to create scheduled bill:', error);
    return errorJson('DB_ERROR', 'Failed to create scheduled bill', 500);
  }
}

/**
 * PUT /api/v1/scheduled-bills - Update a scheduled bill
 */
export async function PUT(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(request);
    if (!auth.success) return auth.response;

    const body = await request.json();
    const { id, ...updateData } = body;

    if (!id) {
      return errorJson('VALIDATION_ERROR', 'Bill ID is required', 400);
    }

    const idValidation = idSchema.safeParse(id);
    if (!idValidation.success) {
      return errorJson('VALIDATION_ERROR', 'Invalid bill ID format', 400);
    }

    const validation = updateBillSchema.safeParse(updateData);

    if (!validation.success) {
      return json(formatZodError(validation.error), 400);
    }

    const db = getDb();
    const now = Date.now();

    // Check if bill exists and belongs to user
    const [existing] = await db
      .select()
      .from(scheduledBills)
      .where(
        and(eq(scheduledBills.id, id), eq(scheduledBills.userId, auth.user.id))
      );

    if (!existing) {
      return errorJson('NOT_FOUND', 'Scheduled bill not found', 404);
    }

    await db
      .update(scheduledBills)
      .set({
        ...validation.data,
        updatedAt: now,
      })
      .where(eq(scheduledBills.id, id));

    const [updated] = await db
      .select()
      .from(scheduledBills)
      .where(eq(scheduledBills.id, id));

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error('Failed to update scheduled bill:', error);
    return errorJson('DB_ERROR', 'Failed to update scheduled bill', 500);
  }
}
