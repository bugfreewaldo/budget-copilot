import { NextRequest } from 'next/server';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '@/lib/db/client';
import {
  households,
  householdMembers,
  householdInvites,
} from '@/lib/db/schema';
import { json, errorJson, idSchema } from '@/lib/api/utils';
import { getUserFromRequest } from '@/lib/auth/getUser';
import { generateId, generateToken } from '@/lib/auth/crypto';

interface RouteParams {
  params: Promise<{ id: string }>;
}

const createInviteSchema = z.object({
  email: z.string().email().optional(),
  role: z.enum(['admin', 'member', 'viewer']).default('member'),
});

const INVITE_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * POST /api/v1/households/:id/invite - Create an invite
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
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

    const body = await request.json();
    const bodyValidation = createInviteSchema.safeParse(body);

    if (!bodyValidation.success) {
      return errorJson('VALIDATION_ERROR', 'Invalid request body', 400, {
        errors: bodyValidation.error.errors,
      });
    }

    const { email, role } = bodyValidation.data;
    const db = getDb();

    // Check if user is an owner or admin of this household
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

    if (membership.role !== 'owner' && membership.role !== 'admin') {
      return errorJson(
        'UNAUTHORIZED',
        'Only owners and admins can create invites',
        403
      );
    }

    // Get household info
    const [household] = await db
      .select()
      .from(households)
      .where(eq(households.id, id));

    if (!household) {
      return errorJson('NOT_FOUND', 'Household not found', 404);
    }

    // Generate invite token
    const inviteToken = generateToken(16);
    const inviteId = generateId();
    const now = Date.now();
    const expiresAt = now + INVITE_EXPIRY_MS;

    await db.insert(householdInvites).values({
      id: inviteId,
      householdId: id,
      email: email || null,
      token: inviteToken,
      role,
      expiresAt,
      createdById: user.id,
      createdAt: now,
    });

    // Build the invite URL
    const baseUrl = request.headers.get('origin') || 'http://localhost:3000';
    const inviteUrl = `${baseUrl}/invite/${inviteToken}`;

    return json(
      {
        invite: {
          id: inviteId,
          token: inviteToken,
          url: inviteUrl,
          email,
          role,
          expiresAt,
          household: {
            id: household.id,
            name: household.name,
          },
        },
      },
      201
    );
  } catch (error) {
    console.error('Failed to create invite:', error);
    return errorJson('DB_ERROR', 'Failed to create invite', 500);
  }
}

/**
 * GET /api/v1/households/:id/invite - Get pending invites for a household
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

    // Check if user is an owner or admin
    const [membership] = await db
      .select()
      .from(householdMembers)
      .where(
        and(
          eq(householdMembers.householdId, id),
          eq(householdMembers.userId, user.id)
        )
      );

    if (
      !membership ||
      (membership.role !== 'owner' && membership.role !== 'admin')
    ) {
      return errorJson('UNAUTHORIZED', 'Access denied', 403);
    }

    // Get pending (unused) invites
    const invites = await db
      .select()
      .from(householdInvites)
      .where(eq(householdInvites.householdId, id));

    const now = Date.now();
    const pendingInvites = invites
      .filter((inv) => !inv.usedAt && inv.expiresAt > now)
      .map((inv) => ({
        id: inv.id,
        email: inv.email,
        role: inv.role,
        expiresAt: inv.expiresAt,
        createdAt: inv.createdAt,
      }));

    return json({ invites: pendingInvites });
  } catch (error) {
    console.error('Failed to get invites:', error);
    return errorJson('DB_ERROR', 'Failed to get invites', 500);
  }
}
