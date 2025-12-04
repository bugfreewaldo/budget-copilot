import { NextRequest } from 'next/server';
import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { debts } from '@/lib/db/schema';
import { formatZodError, json, errorJson } from '@/lib/api/utils';

const debtTypeSchema = z.enum([
  'credit_card',
  'personal_loan',
  'auto_loan',
  'mortgage',
  'student_loan',
  'medical',
  'other',
]);

const debtStatusSchema = z.enum([
  'active',
  'paid_off',
  'defaulted',
  'deferred',
]);

const updateDebtSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  type: debtTypeSchema.optional(),
  current_balance_cents: z.number().int().min(0).optional(),
  apr_percent: z.number().min(0).max(100).optional(),
  minimum_payment_cents: z.number().int().min(0).optional(),
  due_day: z.number().int().min(1).max(31).optional(),
  status: debtStatusSchema.optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/v1/debts/[id] - Get single debt with payments
 */
export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const db = getDb();
    const userId = 'test-user-00000000000000000001';

    const [debt] = await db
      .select()
      .from(debts)
      .where(and(eq(debts.id, id), eq(debts.userId, userId)));

    if (!debt) {
      return errorJson('NOT_FOUND', 'Debt not found', 404);
    }

    return json({ data: { ...debt, payments: [] } });
  } catch (error) {
    console.error('Failed to get debt:', error);
    return errorJson('DB_ERROR', 'Failed to retrieve debt', 500, {
      error: (error as Error).message,
    });
  }
}

/**
 * PATCH /api/v1/debts/[id] - Update debt
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const validation = updateDebtSchema.safeParse(body);

    if (!validation.success) {
      return json(formatZodError(validation.error), 400);
    }

    const db = getDb();
    const userId = 'test-user-00000000000000000001';

    const [existing] = await db
      .select()
      .from(debts)
      .where(and(eq(debts.id, id), eq(debts.userId, userId)));

    if (!existing) {
      return errorJson('NOT_FOUND', 'Debt not found', 404);
    }

    const updates: Record<string, unknown> = { updatedAt: Date.now() };

    if (validation.data.name !== undefined) {
      updates.name = validation.data.name;
    }
    if (validation.data.type !== undefined) {
      updates.type = validation.data.type;
    }
    if (validation.data.current_balance_cents !== undefined) {
      updates.currentBalanceCents = validation.data.current_balance_cents;
    }
    if (validation.data.apr_percent !== undefined) {
      updates.aprPercent = validation.data.apr_percent;
    }
    if (validation.data.minimum_payment_cents !== undefined) {
      updates.minimumPaymentCents = validation.data.minimum_payment_cents;
    }
    if (validation.data.due_day !== undefined) {
      updates.dueDay = validation.data.due_day;
    }
    if (validation.data.status !== undefined) {
      updates.status = validation.data.status;
    }

    await db.update(debts).set(updates).where(eq(debts.id, id));

    const [updated] = await db.select().from(debts).where(eq(debts.id, id));

    return json({ data: updated });
  } catch (error) {
    console.error('Failed to update debt:', error);
    return errorJson('DB_ERROR', 'Failed to update debt', 500, {
      error: (error as Error).message,
    });
  }
}

/**
 * DELETE /api/v1/debts/[id] - Delete debt
 */
export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const db = getDb();
    const userId = 'test-user-00000000000000000001';

    const [existing] = await db
      .select()
      .from(debts)
      .where(and(eq(debts.id, id), eq(debts.userId, userId)));

    if (!existing) {
      return errorJson('NOT_FOUND', 'Debt not found', 404);
    }

    await db.delete(debts).where(eq(debts.id, id));

    return new Response(null, { status: 204 });
  } catch (error) {
    console.error('Failed to delete debt:', error);
    return errorJson('DB_ERROR', 'Failed to delete debt', 500, {
      error: (error as Error).message,
    });
  }
}
