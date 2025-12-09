import { NextRequest, NextResponse } from 'next/server';
import { desc, like, or, sql } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { users } from '@/lib/db/schema';
import { getAdminUser } from '@/lib/api/auth';
import { errorJson } from '@/lib/api/utils';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/admin/users - List all users with search/filter
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await getAdminUser(request);
    if (!auth.success) return auth.response;

    const db = getDb();
    const searchParams = request.nextUrl.searchParams;

    const search = searchParams.get('q');
    const status = searchParams.get('status');
    const role = searchParams.get('role');
    const plan = searchParams.get('plan');
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    // Build query with filters
    let query = db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        avatarUrl: users.avatarUrl,
        emailVerified: users.emailVerified,
        status: users.status,
        role: users.role,
        plan: users.plan,
        planExpiresAt: users.planExpiresAt,
        createdAt: users.createdAt,
        lastLoginAt: users.lastLoginAt,
      })
      .from(users)
      .$dynamic();

    // Apply filters
    const conditions = [];

    if (search) {
      conditions.push(
        or(like(users.email, `%${search}%`), like(users.name, `%${search}%`))
      );
    }

    if (status && ['active', 'suspended', 'deleted'].includes(status)) {
      conditions.push(sql`${users.status} = ${status}`);
    } else {
      // By default, exclude deleted users unless explicitly filtered
      conditions.push(sql`${users.status} != 'deleted'`);
    }

    if (role && ['user', 'admin', 'superadmin'].includes(role)) {
      conditions.push(sql`${users.role} = ${role}`);
    }

    if (plan && ['free', 'pro', 'premium'].includes(plan)) {
      conditions.push(sql`${users.plan} = ${plan}`);
    }

    if (conditions.length > 0) {
      for (const condition of conditions) {
        query = query.where(condition);
      }
    }

    const allUsers = await query
      .orderBy(desc(users.createdAt))
      .limit(limit)
      .offset(offset);

    // Get total count
    const [totalCount = { count: 0 }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(users);
    const count = totalCount.count;

    return NextResponse.json({
      data: allUsers,
      pagination: {
        total: Number(count),
        limit,
        offset,
        hasMore: offset + allUsers.length < Number(count),
      },
    });
  } catch (error) {
    console.error('Failed to list users:', error);
    return errorJson('INTERNAL_ERROR', 'Failed to list users', 500);
  }
}
