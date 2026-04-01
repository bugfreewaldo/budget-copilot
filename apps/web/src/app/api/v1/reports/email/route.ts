import { NextRequest } from 'next/server';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { transactions, users, categories } from '@/lib/db/schema';
import { getAuthenticatedUser } from '@/lib/api/auth';
import { errorJson, json, formatZodError } from '@/lib/api/utils';
import { sendEmail } from '@/lib/email';

export const dynamic = 'force-dynamic';

const emailReportSchema = z.object({
  to: z.string().email().optional(),
  preview: z.boolean().optional(),
  includeTransactions: z.boolean().optional(),
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
    const { to, preview, includeTransactions } = validation.data;

    if (!preview && !to) {
      return errorJson('VALIDATION_ERROR', 'Email address required', 400);
    }

    // Get user info
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    const userName = user?.name || user?.email || 'User';

    // Get all transactions
    const allTxns = await db
      .select()
      .from(transactions)
      .where(eq(transactions.userId, userId));

    const today = new Date();
    const currentMonthStart = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
    const monthTxns = allTxns.filter((t) => t.date >= currentMonthStart);

    const monthIncome = monthTxns
      .filter((t) => t.type === 'income')
      .reduce((s, t) => s + Math.abs(t.amountCents), 0);
    const monthExpenses = monthTxns
      .filter((t) => t.type === 'expense')
      .reduce((s, t) => s + Math.abs(t.amountCents), 0);

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

    // Build spending by category
    const userCategories = await db
      .select()
      .from(categories)
      .where(eq(categories.userId, userId));
    const catMap = new Map(userCategories.map((c) => [c.id, c]));

    const catTotals = new Map<
      string,
      { name: string; emoji: string; total: number }
    >();
    for (const t of monthTxns) {
      if (t.type !== 'expense') continue;
      const cat = t.categoryId ? catMap.get(t.categoryId) : null;
      const parentCat = cat?.parentId ? catMap.get(cat.parentId) : null;
      const displayCat = parentCat || cat;
      const key = displayCat?.id || 'uncategorized';
      const existing = catTotals.get(key);
      if (existing) {
        existing.total += Math.abs(t.amountCents);
      } else {
        catTotals.set(key, {
          name: displayCat?.name || 'Uncategorized',
          emoji: displayCat?.emoji || '',
          total: Math.abs(t.amountCents),
        });
      }
    }
    const topCategories = [...catTotals.values()]
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);
    const totalSpent = topCategories.reduce((s, c) => s + c.total, 0);
    const maxCatTotal = topCategories[0]?.total || 1;

    // Bar colors for categories
    const barColors = [
      '#22d3ee',
      '#a78bfa',
      '#f87171',
      '#4ade80',
      '#fbbf24',
      '#fb923c',
      '#818cf8',
      '#f472b6',
    ];

    // Build category rows
    const categoryRows = topCategories
      .map((cat, i) => {
        const pct = Math.round((cat.total / maxCatTotal) * 100);
        const color = barColors[i % barColors.length];
        return `<tr>
          <td style="padding: 10px 16px; border-bottom: 1px solid #1f2937;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 14px;">${cat.emoji}</span>
              <span style="color: #e5e7eb; font-size: 14px;">${cat.name}</span>
            </div>
            <div style="margin-top: 6px; background-color: #1f2937; border-radius: 4px; height: 6px; overflow: hidden;">
              <div style="width: ${pct}%; height: 100%; background-color: ${color}; border-radius: 4px;"></div>
            </div>
          </td>
          <td style="padding: 10px 16px; border-bottom: 1px solid #1f2937; text-align: right; color: #e5e7eb; font-size: 14px; font-weight: 600; white-space: nowrap;">
            ${formatCurrency(cat.total)}
          </td>
        </tr>`;
      })
      .join('');

    const monthNet = monthIncome - monthExpenses;
    const savingsRate =
      monthIncome > 0 ? Math.round((monthNet / monthIncome) * 100) : 0;

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
              <p style="margin: 8px 0 0; color: #6b7280; font-size: 14px;">${monthLabel}</p>
              <p style="margin: 4px 0 0; color: #4b5563; font-size: 12px;">${reportDate}</p>
            </td>
          </tr>

          <!-- Monthly Balance (big number) -->
          <tr>
            <td style="padding: 24px; background-color: #111827; border-radius: 12px; border: 1px solid #1f2937; text-align: center;">
              <p style="margin: 0 0 4px; color: #9ca3af; font-size: 14px;">Monthly Balance</p>
              <p style="margin: 0; color: ${monthNet >= 0 ? '#4ade80' : '#f87171'}; font-size: 36px; font-weight: 700;">${monthNet >= 0 ? '+' : ''}${formatCurrency(monthNet)}</p>
              ${savingsRate > 0 ? `<p style="margin: 6px 0 0; color: #22d3ee; font-size: 13px;">Saving ${savingsRate}% of your income</p>` : ''}
            </td>
          </tr>

          <!-- Income & Expenses side by side -->
          <tr>
            <td style="padding-top: 12px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td width="49%" style="padding: 14px 16px; background-color: #111827; border-radius: 12px; border: 1px solid #1f2937;">
                    <p style="margin: 0 0 2px; color: #4ade80; font-size: 12px;">Income</p>
                    <p style="margin: 0; color: #4ade80; font-size: 20px; font-weight: 700;">${formatCurrency(monthIncome)}</p>
                  </td>
                  <td width="2%"></td>
                  <td width="49%" style="padding: 14px 16px; background-color: #111827; border-radius: 12px; border: 1px solid #1f2937;">
                    <p style="margin: 0 0 2px; color: #f87171; font-size: 12px;">Expenses</p>
                    <p style="margin: 0; color: #f87171; font-size: 20px; font-weight: 700;">${formatCurrency(monthExpenses)}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Spending by Category -->
          ${
            topCategories.length > 0
              ? `
          <tr>
            <td style="padding-top: 24px;">
              <h2 style="margin: 0 0 12px; color: #ffffff; font-size: 18px;">Spending by Category</h2>
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #111827; border-radius: 12px; border: 1px solid #1f2937; overflow: hidden;">
                ${categoryRows}
                <tr style="background-color: #1f2937;">
                  <td style="padding: 10px 16px; color: #9ca3af; font-size: 13px;">Total Spent</td>
                  <td style="padding: 10px 16px; text-align: right; color: #ffffff; font-size: 14px; font-weight: 700;">${formatCurrency(totalSpent)}</td>
                </tr>
              </table>
            </td>
          </tr>
          `
              : ''
          }

          ${(() => {
            if (!includeTransactions || monthTxns.length === 0) return '';
            const txnRows = [...monthTxns]
              .sort((a, b) => a.date.localeCompare(b.date))
              .map((t) => {
                const desc = t.sensitive ? 'Hidden transaction' : t.description;
                const color = t.type === 'income' ? '#4ade80' : '#f87171';
                const sign = t.type === 'income' ? '+' : '-';
                return `<tr>
                  <td style="padding: 6px 12px; border-bottom: 1px solid #1f2937; color: #9ca3af; font-size: 12px;">${t.date}</td>
                  <td style="padding: 6px 12px; border-bottom: 1px solid #1f2937; color: #e5e7eb; font-size: 12px;">${desc}</td>
                  <td style="padding: 6px 12px; border-bottom: 1px solid #1f2937; text-align: right; font-size: 12px; color: ${color};">${sign}${formatCurrency(Math.abs(t.amountCents))}</td>
                </tr>`;
              })
              .join('');
            return `
          <tr>
            <td style="padding-top: 24px;">
              <h2 style="margin: 0 0 12px; color: #ffffff; font-size: 18px;">All Transactions</h2>
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #111827; border-radius: 12px; border: 1px solid #1f2937; overflow: hidden;">
                <tr style="background-color: #1f2937;">
                  <td style="padding: 8px 12px; color: #9ca3af; font-size: 12px; font-weight: 600;">Date</td>
                  <td style="padding: 8px 12px; color: #9ca3af; font-size: 12px; font-weight: 600;">Description</td>
                  <td style="padding: 8px 12px; color: #9ca3af; font-size: 12px; font-weight: 600; text-align: right;">Amount</td>
                </tr>
                ${txnRows}
              </table>
            </td>
          </tr>`;
          })()}

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

    const textVersion = `Budget Copilot - ${monthLabel}
${reportDate}

Monthly Balance: ${monthNet >= 0 ? '+' : ''}${formatCurrency(monthNet)}${savingsRate > 0 ? ` (Saving ${savingsRate}% of income)` : ''}

Income: ${formatCurrency(monthIncome)}
Expenses: ${formatCurrency(monthExpenses)}

Spending by Category:
${topCategories.map((c) => `  ${c.emoji} ${c.name}: ${formatCurrency(c.total)}`).join('\n')}
  Total: ${formatCurrency(totalSpent)}

Sent from Budget Copilot by ${userName}`;

    // Preview mode — return HTML without sending
    if (preview) {
      return json({ data: { html } });
    }

    const sent = await sendEmail({
      to: to!,
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
