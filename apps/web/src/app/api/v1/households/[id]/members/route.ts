import { NextRequest } from 'next/server';
import { eq, and } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { households, householdMembers, users } from '@/lib/db/schema';
import { json, errorJson, idSchema } from '@/lib/api/utils';
import { getUserFromRequest } from '@/lib/auth/getUser';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/v1/households/:id/members - Get household members
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getUserFromRequest(request);

    if (!user) {
      return errorJson('UNAUTHORIZED', 'Authentication required', 401);
    }

    const { id } = await params;
    const validation = idSchema.safeParse(id);

    if (!validation.success) {
      return errorJson('VALIDATION_ERROR', 'Invalid household ID', 400);
    }

    const db = getDb();

    // Check if user is a member of this household
    const [membership] = await db
      .select()
      .from(householdMembers)
      .where(
        and(
          eq(householdMembers.householdId, id),
          eq(householdMembers.userId, user.id)
        )
      );

    if (!membership) {
      return errorJson('NOT_FOUND', 'Household not found', 404);
    }

    // Get all members with user info
    const members = await db
      .select({
        id: householdMembers.id,
        userId: householdMembers.userId,
        role: householdMembers.role,
        invitedAt: householdMembers.invitedAt,
        acceptedAt: householdMembers.acceptedAt,
        userName: users.name,
        userEmail: users.email,
        userAvatar: users.avatarUrl,
      })
      .from(householdMembers)
      .innerJoin(users, eq(householdMembers.userId, users.id))
      .where(eq(householdMembers.householdId, id));

    return json({
      members: members.map((m) => ({
        id: m.id,
        userId: m.userId,
        role: m.role,
        invitedAt: m.invitedAt,
        acceptedAt: m.acceptedAt,
        user: {
          name: m.userName,
          email: m.userEmail,
          avatarUrl: m.userAvatar,
        },
      })),
    });
  } catch (error) {
    console.error('Failed to get household members:', error);
    return errorJson('DB_ERROR', 'Failed to get household members', 500);
  }
}
