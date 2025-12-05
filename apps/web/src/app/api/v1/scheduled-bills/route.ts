import { NextRequest } from 'next/server';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { eq, desc } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { scheduledBills } from '@/lib/db/schema';
import { formatZodError, json, errorJson, centsSchema } from '@/lib/api/utils';

/**
 * Scheduled Bills validation schemas
 */
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
export async function GET() {
  try {
    const db = getDb();
    // TODO: Get userId from session
    const userId = 'demo-user';

    const result = await db
      .select()
      .from(scheduledBills)
      .where(eq(scheduledBills.userId, userId))
      .orderBy(desc(scheduledBills.createdAt));

    return json({ data: result });
  } catch (error) {
    console.error('Failed to list scheduled bills:', error);
    return errorJson('DB_ERROR', 'Failed to retrieve scheduled bills', 500, {
      error: (error as Error).message,
    });
  }
}

/**
 * POST /api/v1/scheduled-bills - Create a new scheduled bill
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validation = createBillSchema.safeParse(body);

    if (!validation.success) {
      return json(formatZodError(validation.error), 400);
    }

    const db = getDb();
    // TODO: Get userId from session
    const userId = 'demo-user';
    const now = Date.now();
    const id = nanoid();

    await db.insert(scheduledBills).values({
      id,
      userId,
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

    return json({ data: bill }, 201);
  } catch (error) {
    console.error('Failed to create scheduled bill:', error);
    return errorJson('DB_ERROR', 'Failed to create scheduled bill', 500, {
      error: (error as Error).message,
    });
  }
}

/**
 * PUT /api/v1/scheduled-bills - Update a scheduled bill
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...updateData } = body;

    if (!id) {
      return errorJson('VALIDATION_ERROR', 'Bill ID is required', 400);
    }

    const validation = updateBillSchema.safeParse(updateData);

    if (!validation.success) {
      return json(formatZodError(validation.error), 400);
    }

    const db = getDb();
    // TODO: Get userId from session
    const userId = 'demo-user';
    const now = Date.now();

    // Check if bill exists
    const [existing] = await db
      .select()
      .from(scheduledBills)
      .where(eq(scheduledBills.id, id));

    if (!existing || existing.userId !== userId) {
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

    return json({ data: updated });
  } catch (error) {
    console.error('Failed to update scheduled bill:', error);
    return errorJson('DB_ERROR', 'Failed to update scheduled bill', 500, {
      error: (error as Error).message,
    });
  }
}
