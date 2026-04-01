import { NextRequest } from 'next/server';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { transactions, debts, users } from '@/lib/db/schema';
import { getAuthenticatedUser } from '@/lib/api/auth';
import { errorJson, json, formatZodError } from '@/lib/api/utils';
import { sendEmail } from '@/lib/email';

export const dynamic = 'force-dynamic';

const emailReportSchema = z.object({
  to: z.string().email(),
});

function formatCurrency(cents: number): string {
  const abs = Math.abs(cents);
  const sign = cents < 0 ? '-' : '';
  return `${sign}$${(abs / 100).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
}

/**
 * POST /api/v1/reports/email - Send financial summary to an email
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(request);
    if (!auth.success) return auth.response;

    const body = await request.json();
    const validation = emailReportSchema.safeParse(body);
    if (!validation.success) {
      return json(formatZodError(validation.error), 400);
    }

    const db = getDb();
    const userId = auth.user.id;
    const { to } = validation.data;

    // Get user info
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    const userName = user?.name || user?.email || 'User';

    // Get all transactions
    const allTxns = await db
      .select()
      .from(transactions)
      .where(eq(transactions.userId, userId));

    // Get debts
    const userDebts = await db
      .select()
      .from(debts)
      .where(eq(debts.userId, userId));

    // Calculate totals
    const totalBalance = allTxns.reduce((sum, t) => sum + t.amountCents, 0);

    const today = new Date();
    const currentMonthStart = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
    const monthTxns = allTxns.filter((t) => t.date >= currentMonthStart);

    const monthIncome = monthTxns
      .filter((t) => t.type === 'income')
      .reduce((s, t) => s + Math.abs(t.amountCents), 0);
    const monthExpenses = monthTxns
      .filter((t) => t.type === 'expense')
      .reduce((s, t) => s + Math.abs(t.amountCents), 0);

    const activeDebts = userDebts.filter((d) => d.status === 'active');
    const totalDebt = activeDebts.reduce(
      (s, d) => s + d.currentBalanceCents,
      0
    );

    const monthLabel = today.toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
    });
    const reportDate = today.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });

    // Build top expenses by category (this month)
    const catTotals = new Map<string, number>();
    for (const t of monthTxns) {
      if (t.type !== 'expense') continue;
      const key = t.categoryId || 'Uncategorized';
      catTotals.set(key, (catTotals.get(key) || 0) + Math.abs(t.amountCents));
    }
    // Top categories reserved for future use
    [...catTotals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);

    // Build debt summary
    const debtRows = activeDebts
      .sort((a, b) => b.currentBalanceCents - a.currentBalanceCents)
      .map(
        (d) =>
          `<tr>
            <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb;">${d.name}</td>
            <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb; text-align: right; color: #ef4444;">${formatCurrency(d.currentBalanceCents)}</td>
            <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">${d.aprPercent}%</td>
          </tr>`
      )
      .join('');

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #0a0a0a; color: #e5e7eb;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0a0a0a; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px;">
          <!-- Header -->
          <tr>
            <td style="padding: 30px 0;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 700;">Budget Copilot</h1>
              <p style="margin: 8px 0 0; color: #6b7280; font-size: 14px;">Financial Summary for ${userName}</p>
              <p style="margin: 4px 0 0; color: #4b5563; font-size: 12px;">${reportDate}</p>
            </td>
          </tr>

          <!-- Balance Card -->
          <tr>
            <td style="padding: 24px; background-color: #111827; border-radius: 12px; border: 1px solid #1f2937;">
              <p style="margin: 0 0 4px; color: #9ca3af; font-size: 14px;">Total Balance</p>
              <p style="margin: 0; color: ${totalBalance >= 0 ? '#22d3ee' : '#ef4444'}; font-size: 36px; font-weight: 700;">${formatCurrency(totalBalance)}</p>
            </td>
          </tr>

          <!-- Month Summary -->
          <tr>
            <td style="padding-top: 20px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td width="50%" style="padding: 16px; background-color: #111827; border-radius: 12px; border: 1px solid #1f2937;">
                    <p style="margin: 0 0 4px; color: #9ca3af; font-size: 12px;">Income (${monthLabel})</p>
                    <p style="margin: 0; color: #4ade80; font-size: 22px; font-weight: 700;">${formatCurrency(monthIncome)}</p>
                  </td>
                  <td width="8"></td>
                  <td width="50%" style="padding: 16px; background-color: #111827; border-radius: 12px; border: 1px solid #1f2937;">
                    <p style="margin: 0 0 4px; color: #9ca3af; font-size: 12px;">Expenses (${monthLabel})</p>
                    <p style="margin: 0; color: #f87171; font-size: 22px; font-weight: 700;">${formatCurrency(monthExpenses)}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Net this month -->
          <tr>
            <td style="padding-top: 12px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding: 16px; background-color: #111827; border-radius: 12px; border: 1px solid #1f2937;">
                    <p style="margin: 0 0 4px; color: #9ca3af; font-size: 12px;">Net this month</p>
                    <p style="margin: 0; color: ${monthIncome - monthExpenses >= 0 ? '#4ade80' : '#f87171'}; font-size: 22px; font-weight: 700;">${formatCurrency(monthIncome - monthExpenses)}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          ${
            activeDebts.length > 0
              ? `
          <!-- Debts -->
          <tr>
            <td style="padding-top: 24px;">
              <h2 style="margin: 0 0 12px; color: #ffffff; font-size: 18px;">Active Debts</h2>
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #111827; border-radius: 12px; border: 1px solid #1f2937; overflow: hidden;">
                <tr style="background-color: #1f2937;">
                  <td style="padding: 8px 12px; color: #9ca3af; font-size: 12px; font-weight: 600;">Name</td>
                  <td style="padding: 8px 12px; color: #9ca3af; font-size: 12px; font-weight: 600; text-align: right;">Balance</td>
                  <td style="padding: 8px 12px; color: #9ca3af; font-size: 12px; font-weight: 600; text-align: right;">APR</td>
                </tr>
                ${debtRows}
                <tr style="background-color: #1f2937;">
                  <td style="padding: 10px 12px; color: #ffffff; font-weight: 600;">Total Debt</td>
                  <td style="padding: 10px 12px; color: #ef4444; font-weight: 700; text-align: right;">${formatCurrency(totalDebt)}</td>
                  <td></td>
                </tr>
              </table>
            </td>
          </tr>
          `
              : ''
          }

          <!-- Footer -->
          <tr>
            <td style="padding: 30px 0; text-align: center;">
              <p style="margin: 0; color: #4b5563; font-size: 12px;">
                Sent from Budget Copilot by ${userName}
              </p>
              <p style="margin: 4px 0 0; color: #374151; font-size: 11px;">
                budgetcopilot.app
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    const textVersion = `Budget Copilot - Financial Summary for ${userName}
${reportDate}

Total Balance: ${formatCurrency(totalBalance)}

${monthLabel}:
  Income: ${formatCurrency(monthIncome)}
  Expenses: ${formatCurrency(monthExpenses)}
  Net: ${formatCurrency(monthIncome - monthExpenses)}

${activeDebts.length > 0 ? `Active Debts (${activeDebts.length}):\n${activeDebts.map((d) => `  ${d.name}: ${formatCurrency(d.currentBalanceCents)} @ ${d.aprPercent}%`).join('\n')}\n  Total: ${formatCurrency(totalDebt)}` : 'No active debts.'}

Sent from Budget Copilot by ${userName}`;

    const sent = await sendEmail({
      to,
      subject: `Financial Summary - ${monthLabel} | Budget Copilot`,
      html,
      text: textVersion,
    });

    if (!sent) {
      return errorJson('INTERNAL_ERROR', 'Failed to send email', 500);
    }

    return json({ data: { message: `Report sent to ${to}` } });
  } catch (error) {
    console.error('Failed to send report email:', error);
    return errorJson('INTERNAL_ERROR', 'Failed to send report', 500);
  }
}
