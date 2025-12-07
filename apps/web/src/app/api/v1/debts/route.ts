import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { eq, desc } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { getDb } from '@/lib/db/client';
import { debts } from '@/lib/db/schema';
import { getAuthenticatedUser } from '@/lib/api/auth';
import { json, errorJson, formatZodError, idSchema, centsSchema } from '@/lib/api/utils';

export const dynamic = 'force-dynamic';

const createDebtSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum([
    'credit_card',
    'personal_loan',
    'auto_loan',
    'mortgage',
    'student_loan',
    'medical',
    'other',
  ]),
  accountId: idSchema.nullable().optional(),
  originalBalanceCents: centsSchema,
  currentBalanceCents: centsSchema,
  aprPercent: z.number().min(0).max(100),
  minimumPaymentCents: centsSchema.nullable().optional(),
  termMonths: z.number().int().positive().nullable().optional(),
  startDate: z.string().nullable().optional(),
  dueDay: z.number().int().min(1).max(31).nullable().optional(),
  nextDueDate: z.string().nullable().optional(),
});

/**
 * GET /api/v1/debts - List all debts for the user
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(request);
    if (!auth.success) return auth.response;

    const db = getDb();
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');

    const userDebts = await db
      .select()
      .from(debts)
      .where(eq(debts.userId, auth.user.id))
      .orderBy(desc(debts.createdAt));

    // Filter by status if specified
    const filteredDebts = status
      ? userDebts.filter((d) => d.status === status)
      : userDebts;

    // Calculate summary
    const activeDebts = filteredDebts.filter((d) => d.status === 'active');
    const summary = {
      totalDebts: filteredDebts.length,
      activeDebts: activeDebts.length,
      paidOffDebts: filteredDebts.filter((d) => d.status === 'paid_off').length,
      totalOriginalBalanceCents: activeDebts.reduce(
        (sum, d) => sum + d.originalBalanceCents,
        0
      ),
      totalCurrentBalanceCents: activeDebts.reduce(
        (sum, d) => sum + d.currentBalanceCents,
        0
      ),
      totalMinimumPaymentCents: activeDebts.reduce(
        (sum, d) => sum + (d.minimumPaymentCents || 0),
        0
      ),
      averageApr:
        activeDebts.length > 0
          ? activeDebts.reduce((sum, d) => sum + d.aprPercent, 0) / activeDebts.length
          : 0,
    };

    return NextResponse.json({ data: filteredDebts, summary });
  } catch (error) {
    console.error('Failed to list debts:', error);
    return errorJson('INTERNAL_ERROR', 'Failed to list debts', 500);
  }
}

/**
 * POST /api/v1/debts - Create a new debt
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(request);
    if (!auth.success) return auth.response;

    const body = await request.json();
    const validation = createDebtSchema.safeParse(body);

    if (!validation.success) {
      return json(formatZodError(validation.error), 400);
    }

    const data = validation.data;
    const db = getDb();

    const id = nanoid();
    const now = Date.now();

    await db.insert(debts).values({
      id,
      userId: auth.user.id,
      name: data.name,
      type: data.type,
      accountId: data.accountId || null,
      originalBalanceCents: data.originalBalanceCents,
      currentBalanceCents: data.currentBalanceCents,
      aprPercent: data.aprPercent,
      minimumPaymentCents: data.minimumPaymentCents || null,
      termMonths: data.termMonths || null,
      startDate: data.startDate || null,
      dueDay: data.dueDay || null,
      nextDueDate: data.nextDueDate || null,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    });

    const [debt] = await db.select().from(debts).where(eq(debts.id, id));

    return NextResponse.json({ data: debt }, { status: 201 });
  } catch (error) {
    console.error('Failed to create debt:', error);
    return errorJson('INTERNAL_ERROR', 'Failed to create debt', 500);
  }
}
