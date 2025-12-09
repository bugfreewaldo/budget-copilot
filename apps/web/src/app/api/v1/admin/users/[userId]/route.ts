import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { eq, sql } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import {
  users,
  transactions,
  categories,
  accounts,
  debts,
  goals,
  sessions,
} from '@/lib/db/schema';
import { getAdminUser, getSuperadminUser } from '@/lib/api/auth';
import { errorJson, json, formatZodError } from '@/lib/api/utils';

export const dynamic = 'force-dynamic';

const updateUserSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  status: z.enum(['active', 'suspended', 'deleted']).optional(),
  role: z.enum(['user', 'admin', 'superadmin']).optional(),
  plan: z.enum(['free', 'pro', 'premium']).optional(),
  planExpiresAt: z.number().nullable().optional(),
  emailVerified: z.boolean().optional(),
});

/**
 * GET /api/v1/admin/users/:userId - Get user details with stats
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const auth = await getAdminUser(request);
    if (!auth.success) return auth.response;

    const { userId } = await params;
    const db = getDb();

    // Get user
    const [user] = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        avatarUrl: users.avatarUrl,
        emailVerified: users.emailVerified,
        emailVerifiedAt: users.emailVerifiedAt,
        status: users.status,
        role: users.role,
        plan: users.plan,
        planExpiresAt: users.planExpiresAt,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
        lastLoginAt: users.lastLoginAt,
      })
      .from(users)
      .where(eq(users.id, userId));

    if (!user) {
      return errorJson('NOT_FOUND', 'User not found', 404);
    }

    // Get user stats
    const [txCount = { count: 0 }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(transactions)
      .where(eq(transactions.userId, userId));

    const [catCount = { count: 0 }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(categories)
      .where(eq(categories.userId, userId));

    const [accCount = { count: 0 }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(accounts)
      .where(eq(accounts.userId, userId));

    const [debtCount = { count: 0 }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(debts)
      .where(eq(debts.userId, userId));

    const [goalCount = { count: 0 }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(goals)
      .where(eq(goals.userId, userId));

    const [sessionCount = { count: 0 }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(sessions)
      .where(eq(sessions.userId, userId));

    return NextResponse.json({
      data: {
        ...user,
        stats: {
          transactions: Number(txCount.count),
          categories: Number(catCount.count),
          accounts: Number(accCount.count),
          debts: Number(debtCount.count),
          goals: Number(goalCount.count),
          activeSessions: Number(sessionCount.count),
        },
      },
    });
  } catch (error) {
    console.error('Failed to get user:', error);
    return errorJson('INTERNAL_ERROR', 'Failed to get user', 500);
  }
}

/**
 * PATCH /api/v1/admin/users/:userId - Update user
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;

    const body = await request.json();
    const validation = updateUserSchema.safeParse(body);

    if (!validation.success) {
      return json(formatZodError(validation.error), 400);
    }

    const updates = validation.data;

    // If updating role, require superadmin
    if (updates.role !== undefined) {
      const auth = await getSuperadminUser(request);
      if (!auth.success) return auth.response;
    } else {
      const auth = await getAdminUser(request);
      if (!auth.success) return auth.response;
    }

    const db = getDb();

    // Check user exists
    const [existing] = await db
      .select({ id: users.id, role: users.role })
      .from(users)
      .where(eq(users.id, userId));

    if (!existing) {
      return errorJson('NOT_FOUND', 'User not found', 404);
    }

    // Prevent demoting/changing the last superadmin
    if (
      updates.role &&
      updates.role !== 'superadmin' &&
      existing.role === 'superadmin'
    ) {
      const [superadminCount = { count: 0 }] = await db
        .select({ count: sql<number>`count(*)` })
        .from(users)
        .where(eq(users.role, 'superadmin'));

      if (Number(superadminCount.count) <= 1) {
        return errorJson(
          'VALIDATION_ERROR',
          'Cannot demote the last superadmin',
          400
        );
      }
    }

    // Build update object
    const updateData: Record<string, unknown> = {
      updatedAt: Date.now(),
    };

    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.status !== undefined) updateData.status = updates.status;
    if (updates.role !== undefined) updateData.role = updates.role;
    if (updates.plan !== undefined) updateData.plan = updates.plan;
    if (updates.planExpiresAt !== undefined)
      updateData.planExpiresAt = updates.planExpiresAt;
    if (updates.emailVerified !== undefined) {
      updateData.emailVerified = updates.emailVerified;
      if (updates.emailVerified) {
        updateData.emailVerifiedAt = Date.now();
      }
    }

    await db.update(users).set(updateData).where(eq(users.id, userId));

    // Return updated user
    const [updated] = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        status: users.status,
        role: users.role,
        plan: users.plan,
        planExpiresAt: users.planExpiresAt,
        emailVerified: users.emailVerified,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .where(eq(users.id, userId));

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error('Failed to update user:', error);
    return errorJson('INTERNAL_ERROR', 'Failed to update user', 500);
  }
}

/**
 * DELETE /api/v1/admin/users/:userId - Delete user (soft delete)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const auth = await getSuperadminUser(request);
    if (!auth.success) return auth.response;

    const { userId } = await params;
    const db = getDb();

    // Check user exists
    const [existing] = await db
      .select({ id: users.id, role: users.role })
      .from(users)
      .where(eq(users.id, userId));

    if (!existing) {
      return errorJson('NOT_FOUND', 'User not found', 404);
    }

    // Prevent deleting self
    if (existing.id === auth.user.id) {
      return errorJson('VALIDATION_ERROR', 'Cannot delete yourself', 400);
    }

    // Prevent deleting another superadmin
    if (existing.role === 'superadmin') {
      return errorJson(
        'VALIDATION_ERROR',
        'Cannot delete a superadmin user',
        400
      );
    }

    // Soft delete - set status to deleted
    await db
      .update(users)
      .set({
        status: 'deleted',
        updatedAt: Date.now(),
      })
      .where(eq(users.id, userId));

    // Invalidate all sessions
    await db
      .update(sessions)
      .set({
        isValid: false,
        revokedAt: Date.now(),
      })
      .where(eq(sessions.userId, userId));

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Failed to delete user:', error);
    return errorJson('INTERNAL_ERROR', 'Failed to delete user', 500);
  }
}
