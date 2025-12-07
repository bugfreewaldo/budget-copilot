import { NextRequest } from 'next/server';
import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { accounts } from '@/lib/db/schema';
import { getAuthenticatedUser } from '@/lib/api/auth';
import { idSchema, formatZodError, json, errorJson } from '@/lib/api/utils';

const accountTypeSchema = z.enum(['checking', 'savings', 'credit', 'cash']);

const updateAccountSchema = z
  .object({
    name: z.string().min(1).max(100),
    institution: z.string().max(100).nullable(),
    type: accountTypeSchema,
    currentBalanceCents: z.number().int(),
  })
  .partial();

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/v1/accounts/:id - Get account by ID
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await getAuthenticatedUser(request);
    if (!auth.success) return auth.response;

    const { id } = await params;
    const idValidation = idSchema.safeParse(id);
    if (!idValidation.success) {
      return errorJson('VALIDATION_ERROR', 'Invalid account ID', 400);
    }

    const db = getDb();
    const [account] = await db
      .select()
      .from(accounts)
      .where(
        and(
          eq(accounts.id, idValidation.data),
          eq(accounts.userId, auth.user.id)
        )
      );

    if (!account) {
      return errorJson('NOT_FOUND', 'Account not found', 404);
    }

    return json({ data: account });
  } catch (error) {
    console.error('Failed to get account:', error);
    return errorJson('DB_ERROR', 'Failed to retrieve account', 500);
  }
}

/**
 * PATCH /api/v1/accounts/:id - Update account
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await getAuthenticatedUser(request);
    if (!auth.success) return auth.response;

    const { id } = await params;
    const idValidation = idSchema.safeParse(id);
    if (!idValidation.success) {
      return errorJson('VALIDATION_ERROR', 'Invalid account ID', 400);
    }

    const body = await request.json();
    const validation = updateAccountSchema.safeParse(body);
    if (!validation.success) {
      return json(formatZodError(validation.error), 400);
    }

    const db = getDb();

    const [existing] = await db
      .select()
      .from(accounts)
      .where(
        and(
          eq(accounts.id, idValidation.data),
          eq(accounts.userId, auth.user.id)
        )
      );

    if (!existing) {
      return errorJson('NOT_FOUND', 'Account not found', 404);
    }

    await db
      .update(accounts)
      .set(validation.data)
      .where(
        and(
          eq(accounts.id, idValidation.data),
          eq(accounts.userId, auth.user.id)
        )
      );

    const [updated] = await db
      .select()
      .from(accounts)
      .where(eq(accounts.id, idValidation.data));

    return json({ data: updated });
  } catch (error) {
    console.error('Failed to update account:', error);
    return errorJson('DB_ERROR', 'Failed to update account', 500);
  }
}

/**
 * DELETE /api/v1/accounts/:id - Delete account
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await getAuthenticatedUser(request);
    if (!auth.success) return auth.response;

    const { id } = await params;
    const idValidation = idSchema.safeParse(id);
    if (!idValidation.success) {
      return errorJson('VALIDATION_ERROR', 'Invalid account ID', 400);
    }

    const db = getDb();

    const [existing] = await db
      .select()
      .from(accounts)
      .where(
        and(
          eq(accounts.id, idValidation.data),
          eq(accounts.userId, auth.user.id)
        )
      );

    if (!existing) {
      return errorJson('NOT_FOUND', 'Account not found', 404);
    }

    await db
      .delete(accounts)
      .where(
        and(
          eq(accounts.id, idValidation.data),
          eq(accounts.userId, auth.user.id)
        )
      );

    return new Response(null, { status: 204 });
  } catch (error) {
    console.error('Failed to delete account:', error);
    return errorJson('DB_ERROR', 'Failed to delete account', 500);
  }
}
