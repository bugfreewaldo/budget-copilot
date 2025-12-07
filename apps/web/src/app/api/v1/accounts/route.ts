import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { eq, desc } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { getDb } from '@/lib/db/client';
import { accounts } from '@/lib/db/schema';
import { getAuthenticatedUser } from '@/lib/api/auth';
import { json, errorJson, formatZodError } from '@/lib/api/utils';

export const dynamic = 'force-dynamic';

const accountTypeEnum = z.enum(['checking', 'savings', 'credit', 'cash']);

const createAccountSchema = z.object({
  name: z.string().min(1).max(100),
  institution: z.string().max(100).optional().default(''),
  type: accountTypeEnum,
});

/**
 * GET /api/v1/accounts - List all accounts for the user
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(request);
    if (!auth.success) return auth.response;

    const db = getDb();
    const userAccounts = await db
      .select()
      .from(accounts)
      .where(eq(accounts.userId, auth.user.id))
      .orderBy(desc(accounts.createdAt));

    return NextResponse.json({ data: userAccounts });
  } catch (error) {
    console.error('Failed to list accounts:', error);
    return errorJson('INTERNAL_ERROR', 'Failed to list accounts', 500);
  }
}

/**
 * POST /api/v1/accounts - Create a new account
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(request);
    if (!auth.success) return auth.response;

    const body = await request.json();
    const validation = createAccountSchema.safeParse(body);

    if (!validation.success) {
      return json(formatZodError(validation.error), 400);
    }

    const data = validation.data;
    const db = getDb();

    const id = nanoid();
    const now = Date.now();

    await db.insert(accounts).values({
      id,
      userId: auth.user.id,
      name: data.name,
      institution: data.institution,
      type: data.type,
      createdAt: now,
    });

    const [account] = await db
      .select()
      .from(accounts)
      .where(eq(accounts.id, id));

    return NextResponse.json({ data: account }, { status: 201 });
  } catch (error) {
    console.error('Failed to create account:', error);
    return errorJson('INTERNAL_ERROR', 'Failed to create account', 500);
  }
}
