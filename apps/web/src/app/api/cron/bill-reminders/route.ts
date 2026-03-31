import { NextRequest, NextResponse } from 'next/server';
import { eq, and, lte, gte } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { users, scheduledBills } from '@/lib/db/schema';
import { sendEmail } from '@/lib/email';
import { getBillReminderEmailHtml } from '@/lib/email/reminders';

export const dynamic = 'force-dynamic';

/**
 * GET /api/cron/bill-reminders
 * Runs daily — sends email reminders for bills due in the next 3 days
 */
export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getDb();
  const today = new Date();
  const threeDaysFromNow = new Date();
  threeDaysFromNow.setDate(today.getDate() + 3);

  const todayStr = today.toISOString().split('T')[0]!;
  const futureStr = threeDaysFromNow.toISOString().split('T')[0]!;

  try {
    // Find all active bills with due dates in the next 3 days
    const upcomingBills = await db
      .select({
        bill: scheduledBills,
        userId: scheduledBills.userId,
      })
      .from(scheduledBills)
      .where(
        and(
          eq(scheduledBills.status, 'active'),
          gte(scheduledBills.nextDueDate, todayStr),
          lte(scheduledBills.nextDueDate, futureStr)
        )
      );

    if (upcomingBills.length === 0) {
      return NextResponse.json({ sent: 0, message: 'No upcoming bills' });
    }

    // Group bills by user
    const billsByUser = new Map<string, typeof upcomingBills>();
    for (const item of upcomingBills) {
      const existing = billsByUser.get(item.userId) || [];
      existing.push(item);
      billsByUser.set(item.userId, existing);
    }

    let sentCount = 0;

    for (const [userId, userBills] of billsByUser) {
      // Get user email
      const [user] = await db
        .select({ email: users.email, name: users.name })
        .from(users)
        .where(eq(users.id, userId));

      if (!user) continue;

      const bills = userBills.map((b) => ({
        name: b.bill.name,
        amountCents: b.bill.amountCents,
        dueDate: b.bill.nextDueDate!,
        autoPay: b.bill.autoPay || false,
      }));

      const totalCents = bills.reduce(
        (sum, b) => sum + Number(b.amountCents),
        0
      );

      const sent = await sendEmail({
        to: user.email,
        subject: `💰 ${bills.length} bill${bills.length > 1 ? 's' : ''} due soon — Budget Copilot`,
        html: getBillReminderEmailHtml(user.name, bills, totalCents),
        text: `You have ${bills.length} bill(s) due in the next 3 days totaling $${(totalCents / 100).toFixed(2)}.`,
      });

      if (sent) sentCount++;
    }

    return NextResponse.json({ sent: sentCount, bills: upcomingBills.length });
  } catch (error) {
    console.error('Bill reminder cron error:', error);
    return NextResponse.json(
      { error: 'Failed to send bill reminders' },
      { status: 500 }
    );
  }
}
