import { NextRequest } from 'next/server';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { accounts } from '@/lib/db/schema';
import { formatZodError, json, errorJson } from '@/lib/api/utils';

/**
 * Account validation schemas
 */
const accountTypeSchema = z.enum(['checking', 'savings', 'credit', 'cash']);

const createAccountSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  institution: z.string().max(100).optional(),
  type: accountTypeSchema,
  currentBalanceCents: z.number().int().optional().default(0),
});

/**
 * GET /api/v1/accounts - List all accounts
 */
export async function GET() {
  try {
    const db = getDb();
    // TODO: Get userId from session
    const userId = 'test-user-00000000000000000001';

    const result = await db
      .select()
      .from(accounts)
      .where(eq(accounts.userId, userId));

    return json({ data: result });
  } catch (error) {
    console.error('Failed to list accounts:', error);
    return errorJson('DB_ERROR', 'Failed to retrieve accounts', 500, {
      error: (error as Error).message,
    });
  }
}

/**
 * POST /api/v1/accounts - Create new account
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validation = createAccountSchema.safeParse(body);

    if (!validation.success) {
      return json(formatZodError(validation.error), 400);
    }

    const db = getDb();
    // TODO: Get userId from session
    const userId = 'test-user-00000000000000000001';
    const id = nanoid();
    const now = Date.now();

    await db.insert(accounts).values({
      id,
      userId,
      name: validation.data.name,
      institution: validation.data.institution || null,
      type: validation.data.type,
      currentBalanceCents: validation.data.currentBalanceCents,
      createdAt: now,
    });

    const [account] = await db
      .select()
      .from(accounts)
      .where(eq(accounts.id, id));

    return json({ data: account }, 201);
  } catch (error) {
    console.error('Failed to create account:', error);
    return errorJson('DB_ERROR', 'Failed to create account', 500, {
      error: (error as Error).message,
    });
  }
}
