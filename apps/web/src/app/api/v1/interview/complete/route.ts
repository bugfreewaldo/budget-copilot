import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { getDb } from '@/lib/db/client';
import { interviewSessions, userProfiles } from '@/lib/db/schema';
import { getAuthenticatedUser } from '@/lib/api/auth';
import { errorJson } from '@/lib/api/utils';

export const dynamic = 'force-dynamic';

// Calculate insight flags
function calculateInsightFlags(
  extractedData: Record<string, unknown>
): string[] {
  const flags: string[] = [];

  const income =
    (extractedData.income_monthly as { value?: number })?.value || 0;
  const spending =
    (extractedData.spending_monthly as { value?: number })?.value || 0;
  const antExpenses =
    (extractedData.ant_expenses as { value?: number })?.value || 0;
  const savings =
    (extractedData.savings_monthly as { value?: number })?.value || 0;
  const cash = (extractedData.cash_available as { value?: number })?.value || 0;
  const bills = (extractedData.bills_monthly as { value?: number })?.value || 0;

  if (income > 0 && spending + bills > income * 0.9) {
    flags.push('overspend');
  }

  if (income > 0 && cash < income * 0.5) {
    flags.push('no_buffer');
  }

  if (income > 0 && antExpenses > income * 0.1) {
    flags.push('ant_expenses_high');
  }

  if (savings === 0 || savings < income * 0.05) {
    flags.push('no_savings');
  }

  return flags;
}

/**
 * POST /api/v1/interview/complete - Manually complete the interview
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(request);
    if (!auth.success) return auth.response;

    const userId = auth.user.id;
    const db = getDb();

    const session = await db
      .select()
      .from(interviewSessions)
      .where(eq(interviewSessions.userId, userId))
      .get();

    if (!session) {
      return errorJson('NOT_FOUND', 'No hay sesión de entrevista.', 404);
    }

    const extractedData = session.extractedData
      ? JSON.parse(session.extractedData)
      : {};

    // Calculate final insight flags
    const insightFlags = calculateInsightFlags(extractedData);

    // Mark as completed
    await db
      .update(interviewSessions)
      .set({
        status: 'completed',
        insightFlags: JSON.stringify(insightFlags),
        completedAt: Date.now(),
        lastActivityAt: Date.now(),
      })
      .where(eq(interviewSessions.id, session.id));

    // Update user profile
    const existingProfile = await db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.userId, userId))
      .get();

    const profileData = {
      onboardingCompleted: true,
      onboardingStep: 8,
      monthlySalaryCents: extractedData.income_monthly?.value
        ? Math.round(extractedData.income_monthly.value * 100)
        : undefined,
      monthlySavingsGoalCents: extractedData.savings_monthly?.value
        ? Math.round(extractedData.savings_monthly.value * 100)
        : undefined,
      updatedAt: Date.now(),
    };

    if (existingProfile) {
      await db
        .update(userProfiles)
        .set(profileData)
        .where(eq(userProfiles.userId, userId));
    } else {
      await db.insert(userProfiles).values({
        id: nanoid(),
        userId,
        ...profileData,
        createdAt: Date.now(),
      });
    }

    return NextResponse.json({
      data: {
        success: true,
        summary:
          'Tu información financiera ha sido registrada. Ya puedes ver tu instrucción diaria.',
        insightFlags,
      },
    });
  } catch (error) {
    console.error('Failed to complete interview:', error);
    return errorJson('INTERNAL_ERROR', 'Failed to complete interview', 500);
  }
}
