import { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '@/lib/db/client';
import { households, householdMembers } from '@/lib/db/schema';
import { json, errorJson } from '@/lib/api/utils';
import { getUserFromRequest } from '@/lib/auth/getUser';
import { generateId, generateToken } from '@/lib/auth/crypto';

// Force dynamic rendering since getUserFromRequest uses cookies
export const dynamic = 'force-dynamic';

const createHouseholdSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
});

/**
 * GET /api/v1/households - Get user's households
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);

    if (!user) {
      return errorJson('UNAUTHORIZED', 'Authentication required', 401);
    }

    const db = getDb();

    // Get all households the user is a member of
    const memberRecords = await db
      .select({
        household: households,
        member: householdMembers,
      })
      .from(householdMembers)
      .innerJoin(households, eq(householdMembers.householdId, households.id))
      .where(eq(householdMembers.userId, user.id));

    const result = memberRecords.map((record) => ({
      ...record.household,
      role: record.member.role,
      joinedAt: record.member.acceptedAt || record.member.invitedAt,
    }));

    return json({ households: result });
  } catch (error) {
    console.error('Failed to get households:', error);
    return errorJson('DB_ERROR', 'Failed to get households', 500);
  }
}

/**
 * POST /api/v1/households - Create a new household
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);

    if (!user) {
      return errorJson('UNAUTHORIZED', 'Authentication required', 401);
    }

    const body = await request.json();
    const validation = createHouseholdSchema.safeParse(body);

    if (!validation.success) {
      return errorJson('VALIDATION_ERROR', 'Invalid request body', 400, {
        errors: validation.error.errors,
      });
    }

    const { name } = validation.data;
    const db = getDb();
    const now = Date.now();

    // Generate a unique invite code
    const inviteCode = generateToken(4).toUpperCase(); // 8 character code

    // Create the household
    const householdId = generateId();
    await db.insert(households).values({
      id: householdId,
      name,
      inviteCode,
      createdById: user.id,
      createdAt: now,
      updatedAt: now,
    });

    // Add the creator as owner
    const memberId = generateId();
    await db.insert(householdMembers).values({
      id: memberId,
      householdId,
      userId: user.id,
      role: 'owner',
      invitedAt: now,
      acceptedAt: now,
    });

    // Fetch the created household
    const [newHousehold] = await db
      .select()
      .from(households)
      .where(eq(households.id, householdId));

    return json(
      {
        household: {
          ...newHousehold,
          role: 'owner',
        },
      },
      201
    );
  } catch (error) {
    console.error('Failed to create household:', error);
    return errorJson('DB_ERROR', 'Failed to create household', 500);
  }
}
