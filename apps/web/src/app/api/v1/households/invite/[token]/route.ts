import { NextRequest } from 'next/server';
import { eq, and } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import {
  households,
  householdMembers,
  householdInvites,
  users,
} from '@/lib/db/schema';
import { json, errorJson } from '@/lib/api/utils';
import { getUserFromRequest } from '@/lib/auth/getUser';
import { generateId } from '@/lib/auth/crypto';

interface RouteParams {
  params: Promise<{ token: string }>;
}

/**
 * GET /api/v1/households/invite/:token - Get invite details
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { token } = await params;

    if (!token) {
      return errorJson('VALIDATION_ERROR', 'Invalid invite token', 400);
    }

    const db = getDb();

    // Find the invite
    const [invite] = await db
      .select()
      .from(householdInvites)
      .where(eq(householdInvites.token, token));

    if (!invite) {
      return errorJson('NOT_FOUND', 'Invite not found', 404);
    }

    // Check if invite is still valid
    if (invite.usedAt) {
      return errorJson('VALIDATION_ERROR', 'This invite has already been used', 400);
    }

    if (invite.expiresAt < Date.now()) {
      return errorJson('VALIDATION_ERROR', 'This invite has expired', 400);
    }

    // Get household info
    const [household] = await db
      .select()
      .from(households)
      .where(eq(households.id, invite.householdId));

    if (!household) {
      return errorJson('NOT_FOUND', 'Household not found', 404);
    }

    // Get inviter info
    const [inviter] = await db
      .select({ name: users.name, email: users.email })
      .from(users)
      .where(eq(users.id, invite.createdById));

    // Get member count
    const members = await db
      .select()
      .from(householdMembers)
      .where(eq(householdMembers.householdId, invite.householdId));

    return json({
      invite: {
        role: invite.role,
        email: invite.email,
        expiresAt: invite.expiresAt,
        household: {
          id: household.id,
          name: household.name,
          memberCount: members.length,
        },
        invitedBy: inviter
          ? { name: inviter.name, email: inviter.email }
          : null,
      },
    });
  } catch (error) {
    console.error('Failed to get invite:', error);
    return errorJson('DB_ERROR', 'Failed to get invite', 500);
  }
}

/**
 * POST /api/v1/households/invite/:token - Accept an invite
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getUserFromRequest(request);

    if (!user) {
      return errorJson('UNAUTHORIZED', 'Authentication required', 401);
    }

    const { token } = await params;

    if (!token) {
      return errorJson('VALIDATION_ERROR', 'Invalid invite token', 400);
    }

    const db = getDb();

    // Find the invite
    const [invite] = await db
      .select()
      .from(householdInvites)
      .where(eq(householdInvites.token, token));

    if (!invite) {
      return errorJson('NOT_FOUND', 'Invite not found', 404);
    }

    // Check if invite is still valid
    if (invite.usedAt) {
      return errorJson('VALIDATION_ERROR', 'This invite has already been used', 400);
    }

    if (invite.expiresAt < Date.now()) {
      return errorJson('VALIDATION_ERROR', 'This invite has expired', 400);
    }

    // Check if invite is for a specific email
    if (invite.email && invite.email.toLowerCase() !== user.email.toLowerCase()) {
      return errorJson(
        'VALIDATION_ERROR',
        'This invite was sent to a different email address',
        400
      );
    }

    // Check if user is already a member
    const [existingMembership] = await db
      .select()
      .from(householdMembers)
      .where(
        and(
          eq(householdMembers.householdId, invite.householdId),
          eq(householdMembers.userId, user.id)
        )
      );

    if (existingMembership) {
      return errorJson(
        'VALIDATION_ERROR',
        'You are already a member of this household',
        400
      );
    }

    const now = Date.now();

    // Add user as member
    const memberId = generateId();
    await db.insert(householdMembers).values({
      id: memberId,
      householdId: invite.householdId,
      userId: user.id,
      role: invite.role,
      invitedAt: invite.createdAt,
      acceptedAt: now,
    });

    // Mark invite as used
    await db
      .update(householdInvites)
      .set({ usedAt: now })
      .where(eq(householdInvites.id, invite.id));

    // Get household info
    const [household] = await db
      .select()
      .from(households)
      .where(eq(households.id, invite.householdId));

    return json({
      success: true,
      household: {
        id: household?.id,
        name: household?.name,
        role: invite.role,
      },
    });
  } catch (error) {
    console.error('Failed to accept invite:', error);
    return errorJson('DB_ERROR', 'Failed to accept invite', 500);
  }
}
