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

    // Build transaction rows if needed
    const txnSection = (() => {
      if (!includeTransactions || monthTxns.length === 0) return '';
      const txnRows = [...monthTxns]
        .sort((a, b) => a.date.localeCompare(b.date))
        .map((t, i) => {
          const desc = t.sensitive ? 'Hidden transaction' : t.description;
          const color = t.type === 'income' ? '#4ade80' : '#f87171';
          const sign = t.type === 'income' ? '+' : '-';
          const bg = i % 2 === 0 ? '#111827' : '#0d1320';
          return `<tr style="background-color: ${bg};">
            <td style="padding: 8px 16px; color: #6b7280; font-size: 12px; white-space: nowrap;">${t.date}</td>
            <td style="padding: 8px 16px; color: #d1d5db; font-size: 13px;">${desc}</td>
            <td style="padding: 8px 16px; text-align: right; font-size: 13px; font-weight: 500; color: ${color}; white-space: nowrap;">${sign}${formatCurrency(Math.abs(t.amountCents))}</td>
          </tr>`;
        })
        .join('');
      return `
      <tr>
        <td style="padding-top: 32px;">
          <h2 style="margin: 0 0 16px; color: #ffffff; font-size: 16px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">All Transactions</h2>
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #111827; border-radius: 12px; overflow: hidden;">
            <tr style="background-color: #1f2937;">
              <td style="padding: 10px 16px; color: #6b7280; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Date</td>
              <td style="padding: 10px 16px; color: #6b7280; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Description</td>
              <td style="padding: 10px 16px; color: #6b7280; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; text-align: right;">Amount</td>
            </tr>
            ${txnRows}
          </table>
        </td>
      </tr>`;
    })();

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #030712;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #030712; padding: 0;">
    <tr>
      <td align="center">
        <!-- Gradient Header -->
        <table width="100%" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, #7c3aed 0%, #06b6d4 100%);">
          <tr>
            <td align="center" style="padding: 40px 20px 48px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px;">
                <tr>
                  <td>
                    <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 800; letter-spacing: -0.5px;">Budget Copilot</h1>
                    <p style="margin: 8px 0 0; color: rgba(255,255,255,0.7); font-size: 14px;">${monthLabel}</p>
                  </td>
                  <td style="text-align: right;">
                    <p style="margin: 0; color: rgba(255,255,255,0.5); font-size: 12px;">${reportDate}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>

        <!-- Content -->
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin-top: -24px;" align="center">
          <!-- Monthly Balance Hero -->
          <tr>
            <td style="padding: 0 20px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #111827; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.3);">
                <tr>
                  <td style="padding: 28px 24px; text-align: center;">
                    <p style="margin: 0 0 6px; color: #6b7280; font-size: 13px; text-transform: uppercase; letter-spacing: 1px;">Monthly Balance</p>
                    <p style="margin: 0; color: ${monthNet >= 0 ? '#4ade80' : '#f87171'}; font-size: 42px; font-weight: 800; letter-spacing: -1px;">${monthNet >= 0 ? '+' : ''}${formatCurrency(monthNet)}</p>
                    ${savingsRate > 0 ? `<p style="margin: 10px 0 0; color: #22d3ee; font-size: 13px; font-weight: 500;">Saving ${savingsRate}% of your income</p>` : savingsRate < 0 ? `<p style="margin: 10px 0 0; color: #f87171; font-size: 13px; font-weight: 500;">Spending more than you earn</p>` : ''}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Income & Expenses -->
          <tr>
            <td style="padding: 12px 20px 0;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td width="49%" style="padding: 18px 20px; background-color: #111827; border-radius: 12px;">
                    <p style="margin: 0 0 4px; color: #6b7280; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">Income</p>
                    <p style="margin: 0; color: #4ade80; font-size: 22px; font-weight: 700;">${formatCurrency(monthIncome)}</p>
                  </td>
                  <td width="2%"></td>
                  <td width="49%" style="padding: 18px 20px; background-color: #111827; border-radius: 12px;">
                    <p style="margin: 0 0 4px; color: #6b7280; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">Expenses</p>
                    <p style="margin: 0; color: #f87171; font-size: 22px; font-weight: 700;">${formatCurrency(monthExpenses)}</p>
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
            <td style="padding: 32px 20px 0;">
              <h2 style="margin: 0 0 16px; color: #ffffff; font-size: 16px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">Spending by Category</h2>
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #111827; border-radius: 12px; overflow: hidden;">
                ${categoryRows}
                <tr style="background-color: #0d1320;">
                  <td style="padding: 12px 16px; color: #6b7280; font-size: 13px; font-weight: 500;">Total Spent</td>
                  <td style="padding: 12px 16px; text-align: right; color: #ffffff; font-size: 15px; font-weight: 700;">${formatCurrency(totalSpent)}</td>
                </tr>
              </table>
            </td>
          </tr>
          `
              : ''
          }

          <!-- Transactions (optional) -->
          ${txnSection ? `<tr><td style="padding: 0 20px;">${txnSection}</td></tr>` : ''}

          <!-- Footer -->
          <tr>
            <td style="padding: 40px 20px 48px; text-align: center;">
              <div style="width: 40px; height: 3px; background: linear-gradient(90deg, #7c3aed, #06b6d4); margin: 0 auto 16px; border-radius: 2px;"></div>
              <p style="margin: 0; color: #4b5563; font-size: 13px;">
                Sent from <span style="color: #9ca3af; font-weight: 500;">Budget Copilot</span> by ${userName}
              </p>
              <p style="margin: 6px 0 0;">
                <a href="https://budgetcopilot.app" style="color: #7c3aed; text-decoration: none; font-size: 12px;">budgetcopilot.app</a>
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
