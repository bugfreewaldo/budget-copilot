import { NextRequest, NextResponse } from 'next/server';
import { eq, and, sql } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { users, envelopes } from '@/lib/db/schema';
import { sendEmail } from '@/lib/email';
import { getBudgetAlertEmailHtml } from '@/lib/email/reminders';

export const dynamic = 'force-dynamic';

/**
 * GET /api/cron/budget-alerts
 * Runs daily — sends alerts when envelope spending exceeds 80% of budget
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getDb();
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  try {
    // Get all envelopes for this month where spending >= 80% of budget
    const overBudgetEnvelopes = await db
      .select()
      .from(envelopes)
      .where(
        and(
          eq(envelopes.month, currentMonth),
          sql`${envelopes.spentCents} >= ${envelopes.budgetCents} * 0.8`
        )
      );

    if (overBudgetEnvelopes.length === 0) {
      return NextResponse.json({ sent: 0, message: 'No budget alerts' });
    }

    // Group by user
    const alertsByUser = new Map<
      string,
      Array<{ categoryId: string; budgetCents: number; spentCents: number }>
    >();
    for (const env of overBudgetEnvelopes) {
      const existing = alertsByUser.get(env.userId) || [];
      existing.push({
        categoryId: env.categoryId,
        budgetCents: Number(env.budgetCents),
        spentCents: Number(env.spentCents),
      });
      alertsByUser.set(env.userId, existing);
    }

    let sentCount = 0;

    for (const [userId, alerts] of alertsByUser) {
      const [user] = await db
        .select({ email: users.email, name: users.name })
        .from(users)
        .where(eq(users.id, userId));

      if (!user) continue;

      const categories = alerts.map((a) => ({
        name: a.categoryId, // Will be resolved in template if needed
        budgetCents: a.budgetCents,
        spentCents: a.spentCents,
        percentUsed: Math.round((a.spentCents / a.budgetCents) * 100),
      }));

      const overBudgetCount = categories.filter(
        (c) => c.percentUsed >= 100
      ).length;
      const nearBudgetCount = categories.filter(
        (c) => c.percentUsed >= 80 && c.percentUsed < 100
      ).length;

      const sent = await sendEmail({
        to: user.email,
        subject: `⚠️ ${overBudgetCount > 0 ? `${overBudgetCount} over budget` : `${nearBudgetCount} near budget limit`} — Budget Copilot`,
        html: getBudgetAlertEmailHtml(user.name, categories),
        text: `Budget alert: ${categories.length} categories are at 80% or more of their budget for ${currentMonth}.`,
      });

      if (sent) sentCount++;
    }

    return NextResponse.json({
      sent: sentCount,
      alerts: overBudgetEnvelopes.length,
    });
  } catch (error) {
    console.error('Budget alert cron error:', error);
    return NextResponse.json(
      { error: 'Failed to send budget alerts' },
      { status: 500 }
    );
  }
}
