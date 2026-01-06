import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { getDb } from '@/lib/db/client';
import { interviewSessions, userProfiles } from '@/lib/db/schema';
import { getAuthenticatedUser } from '@/lib/api/auth';
import { errorJson } from '@/lib/api/utils';

export const dynamic = 'force-dynamic';

/**
 * POST /api/v1/interview/skip - Skip the interview
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(request);
    if (!auth.success) return auth.response;

    const userId = auth.user.id;
    const db = getDb();

    // Get existing session
    const session = await db
      .select()
      .from(interviewSessions)
      .where(eq(interviewSessions.userId, userId))
      .get();

    if (session) {
      // Mark as abandoned
      await db
        .update(interviewSessions)
        .set({
          status: 'abandoned',
          lastActivityAt: Date.now(),
        })
        .where(eq(interviewSessions.id, session.id));
    }

    // Mark onboarding as complete (skipped)
    const existingProfile = await db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.userId, userId))
      .get();

    if (existingProfile) {
      await db
        .update(userProfiles)
        .set({
          onboardingCompleted: true,
          onboardingStep: 0, // Skipped
          updatedAt: Date.now(),
        })
        .where(eq(userProfiles.userId, userId));
    } else {
      await db.insert(userProfiles).values({
        id: nanoid(),
        userId,
        onboardingCompleted: true,
        onboardingStep: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }

    return NextResponse.json({
      data: {
        success: true,
        message: 'Puedes completar esta información más tarde.',
      },
    });
  } catch (error) {
    console.error('Failed to skip interview:', error);
    return errorJson('INTERNAL_ERROR', 'Failed to skip interview', 500);
  }
}
