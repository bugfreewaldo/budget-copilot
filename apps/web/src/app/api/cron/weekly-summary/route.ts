import { NextRequest, NextResponse } from 'next/server';
import { eq, and, gte, lte } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import {
  users,
  transactions,
  accounts,
  scheduledBills,
  debts,
} from '@/lib/db/schema';
import { sendEmail } from '@/lib/email';
import { getWeeklySummaryEmailHtml } from '@/lib/email/reminders';

export const dynamic = 'force-dynamic';

/**
 * GET /api/cron/weekly-summary
 * Runs every Monday — sends a weekly financial summary
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getDb();
  const now = new Date();
  const weekAgo = new Date();
  weekAgo.setDate(now.getDate() - 7);

  const weekAgoStr = weekAgo.toISOString().split('T')[0]!;
  const todayStr = now.toISOString().split('T')[0]!;

  try {
    // Get all active users
    const allUsers = await db
      .select({ id: users.id, email: users.email, name: users.name })
      .from(users)
      .where(eq(users.status, 'active'));

    let sentCount = 0;

    for (const user of allUsers) {
      // Get this week's transactions
      const weeklyTx = await db
        .select()
        .from(transactions)
        .where(
          and(
            eq(transactions.userId, user.id),
            gte(transactions.date, weekAgoStr),
            lte(transactions.date, todayStr)
          )
        );

      const totalIncome = weeklyTx
        .filter((tx) => tx.type === 'income')
        .reduce((sum, tx) => sum + Math.abs(Number(tx.amountCents)), 0);

      const totalExpenses = weeklyTx
        .filter((tx) => tx.type === 'expense')
        .reduce((sum, tx) => sum + Math.abs(Number(tx.amountCents)), 0);

      const transactionCount = weeklyTx.length;

      // Get account balances
      const userAccounts = await db
        .select()
        .from(accounts)
        .where(eq(accounts.userId, user.id));

      const totalBalance = userAccounts.reduce(
        (sum, a) => sum + Number(a.currentBalanceCents || 0),
        0
      );

      // Get upcoming bills (next 7 days)
      const nextWeek = new Date();
      nextWeek.setDate(now.getDate() + 7);
      const nextWeekStr = nextWeek.toISOString().split('T')[0]!;

      const upcomingBills = await db
        .select()
        .from(scheduledBills)
        .where(
          and(
            eq(scheduledBills.userId, user.id),
            eq(scheduledBills.status, 'active'),
            gte(scheduledBills.nextDueDate, todayStr),
            lte(scheduledBills.nextDueDate, nextWeekStr)
          )
        );

      const upcomingBillsTotal = upcomingBills.reduce(
        (sum, b) => sum + Number(b.amountCents),
        0
      );

      // Get active debts
      const activeDebts = await db
        .select()
        .from(debts)
        .where(and(eq(debts.userId, user.id), eq(debts.status, 'active')));

      const totalDebt = activeDebts.reduce(
        (sum, d) => sum + Number(d.currentBalanceCents),
        0
      );

      // Skip users with zero activity and no data
      if (
        transactionCount === 0 &&
        totalBalance === 0 &&
        upcomingBills.length === 0
      ) {
        continue;
      }

      const netSavings = totalIncome - totalExpenses;

      const sent = await sendEmail({
        to: user.email,
        subject: `📊 Your weekly financial summary — Budget Copilot`,
        html: getWeeklySummaryEmailHtml(user.name, {
          totalIncome,
          totalExpenses,
          netSavings,
          transactionCount,
          totalBalance,
          upcomingBillsCount: upcomingBills.length,
          upcomingBillsTotal,
          totalDebt,
          weekStart: weekAgoStr,
          weekEnd: todayStr,
        }),
        text: `Weekly summary: Income $${(totalIncome / 100).toFixed(2)}, Expenses $${(totalExpenses / 100).toFixed(2)}, Net ${netSavings >= 0 ? '+' : '-'}$${(Math.abs(netSavings) / 100).toFixed(2)}`,
      });

      if (sent) sentCount++;
    }

    return NextResponse.json({ sent: sentCount, users: allUsers.length });
  } catch (error) {
    console.error('Weekly summary cron error:', error);
    return NextResponse.json(
      { error: 'Failed to send weekly summaries' },
      { status: 500 }
    );
  }
}
