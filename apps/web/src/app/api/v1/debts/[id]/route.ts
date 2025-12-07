import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { debts } from '@/lib/db/schema';
import { getAuthenticatedUser } from '@/lib/api/auth';
import { json, errorJson, formatZodError, idSchema, centsSchema } from '@/lib/api/utils';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ id: string }>;
}

const updateDebtSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  type: z.enum([
    'credit_card',
    'personal_loan',
    'auto_loan',
    'mortgage',
    'student_loan',
    'medical',
    'other',
  ]).optional(),
  accountId: idSchema.nullable().optional(),
  originalBalanceCents: centsSchema.optional(),
  currentBalanceCents: centsSchema.optional(),
  aprPercent: z.number().min(0).max(100).optional(),
  minimumPaymentCents: centsSchema.nullable().optional(),
  termMonths: z.number().int().positive().nullable().optional(),
  startDate: z.string().nullable().optional(),
  dueDay: z.number().int().min(1).max(31).nullable().optional(),
  nextDueDate: z.string().nullable().optional(),
  status: z.enum(['active', 'paid_off', 'defaulted', 'deferred']).optional(),
});

/**
 * GET /api/v1/debts/:id - Get a single debt
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await getAuthenticatedUser(request);
    if (!auth.success) return auth.response;

    const { id } = await params;
    const idValidation = idSchema.safeParse(id);
    if (!idValidation.success) {
      return errorJson('VALIDATION_ERROR', 'Invalid debt ID', 400);
    }

    const db = getDb();
    const [debt] = await db
      .select()
      .from(debts)
      .where(and(eq(debts.id, idValidation.data), eq(debts.userId, auth.user.id)));

    if (!debt) {
      return errorJson('NOT_FOUND', 'Debt not found', 404);
    }

    return NextResponse.json({ data: debt });
  } catch (error) {
    console.error('Failed to get debt:', error);
    return errorJson('INTERNAL_ERROR', 'Failed to get debt', 500);
  }
}

/**
 * PATCH /api/v1/debts/:id - Update a debt
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await getAuthenticatedUser(request);
    if (!auth.success) return auth.response;

    const { id } = await params;
    const idValidation = idSchema.safeParse(id);
    if (!idValidation.success) {
      return errorJson('VALIDATION_ERROR', 'Invalid debt ID', 400);
    }

    const body = await request.json();
    const validation = updateDebtSchema.safeParse(body);

    if (!validation.success) {
      return json(formatZodError(validation.error), 400);
    }

    const db = getDb();

    // Check if debt exists and belongs to user
    const [existing] = await db
      .select()
      .from(debts)
      .where(and(eq(debts.id, idValidation.data), eq(debts.userId, auth.user.id)));

    if (!existing) {
      return errorJson('NOT_FOUND', 'Debt not found', 404);
    }

    const data = validation.data;
    const now = Date.now();

    // Auto-set to paid_off if balance reaches 0
    let status = data.status ?? existing.status;
    if (data.currentBalanceCents !== undefined && data.currentBalanceCents <= 0 && status === 'active') {
      status = 'paid_off';
    }

    await db
      .update(debts)
      .set({
        ...data,
        status,
        updatedAt: now,
      })
      .where(eq(debts.id, idValidation.data));

    const [updated] = await db.select().from(debts).where(eq(debts.id, idValidation.data));

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error('Failed to update debt:', error);
    return errorJson('INTERNAL_ERROR', 'Failed to update debt', 500);
  }
}

/**
 * DELETE /api/v1/debts/:id - Delete a debt
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await getAuthenticatedUser(request);
    if (!auth.success) return auth.response;

    const { id } = await params;
    const idValidation = idSchema.safeParse(id);
    if (!idValidation.success) {
      return errorJson('VALIDATION_ERROR', 'Invalid debt ID', 400);
    }

    const db = getDb();

    const [existing] = await db
      .select()
      .from(debts)
      .where(and(eq(debts.id, idValidation.data), eq(debts.userId, auth.user.id)));

    if (!existing) {
      return errorJson('NOT_FOUND', 'Debt not found', 404);
    }

    await db
      .delete(debts)
      .where(and(eq(debts.id, idValidation.data), eq(debts.userId, auth.user.id)));

    return new Response(null, { status: 204 });
  } catch (error) {
    console.error('Failed to delete debt:', error);
    return errorJson('DB_ERROR', 'Failed to delete debt', 500);
  }
}
