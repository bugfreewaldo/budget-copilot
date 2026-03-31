const APP_NAME = 'Budget Copilot';

function formatCents(cents: number): string {
  return `$${(Math.abs(cents) / 100).toFixed(2)}`;
}

function emailWrapper(content: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <tr>
            <td style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); padding: 30px 40px;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 700;">🧠 ${APP_NAME}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px;">
              ${content}
            </td>
          </tr>
          <tr>
            <td style="padding: 20px 40px; background-color: #f9fafb; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; color: #6b7280; font-size: 12px; text-align: center;">
                <a href="https://budgetcopilot.app/dashboard" style="color: #6366f1; text-decoration: none;">Open Dashboard</a> &middot;
                © ${new Date().getFullYear()} ${APP_NAME}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ============================================================================
// BILL REMINDER
// ============================================================================

export function getBillReminderEmailHtml(
  name: string | null,
  bills: Array<{
    name: string;
    amountCents: number;
    dueDate: string;
    autoPay: boolean;
  }>,
  totalCents: number
): string {
  const greeting = name ? `Hi ${name},` : 'Hi,';

  const billRows = bills
    .map(
      (b) => `
      <tr>
        <td style="padding: 12px 0; border-bottom: 1px solid #f3f4f6; color: #18181b; font-size: 15px;">
          ${b.name} ${b.autoPay ? '<span style="color: #10b981; font-size: 12px;">✓ Auto-pay</span>' : ''}
        </td>
        <td style="padding: 12px 0; border-bottom: 1px solid #f3f4f6; color: #18181b; font-size: 15px; text-align: right; font-weight: 600;">
          ${formatCents(b.amountCents)}
        </td>
        <td style="padding: 12px 0; border-bottom: 1px solid #f3f4f6; color: #71717a; font-size: 14px; text-align: right;">
          ${b.dueDate}
        </td>
      </tr>`
    )
    .join('');

  return emailWrapper(`
    <h2 style="margin: 0 0 8px; color: #18181b; font-size: 22px; font-weight: 600;">Bills Due Soon</h2>
    <p style="margin: 0 0 24px; color: #3f3f46; font-size: 15px; line-height: 1.6;">
      ${greeting} You have <strong>${bills.length} bill${bills.length > 1 ? 's' : ''}</strong> due in the next 3 days.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 20px;">
      <tr style="border-bottom: 2px solid #e5e7eb;">
        <td style="padding: 8px 0; color: #71717a; font-size: 13px; font-weight: 600; text-transform: uppercase;">Bill</td>
        <td style="padding: 8px 0; color: #71717a; font-size: 13px; font-weight: 600; text-transform: uppercase; text-align: right;">Amount</td>
        <td style="padding: 8px 0; color: #71717a; font-size: 13px; font-weight: 600; text-transform: uppercase; text-align: right;">Due</td>
      </tr>
      ${billRows}
    </table>
    <div style="padding: 16px; background-color: #fef3c7; border-radius: 8px; margin-bottom: 24px;">
      <p style="margin: 0; color: #92400e; font-size: 15px; font-weight: 600;">
        Total due: ${formatCents(totalCents)}
      </p>
    </div>
    <a href="https://budgetcopilot.app/recurrentes" style="display: inline-block; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; font-size: 14px;">
      View Bills →
    </a>
  `);
}

// ============================================================================
// BUDGET ALERT
// ============================================================================

export function getBudgetAlertEmailHtml(
  name: string | null,
  categories: Array<{
    name: string;
    budgetCents: number;
    spentCents: number;
    percentUsed: number;
  }>
): string {
  const greeting = name ? `Hi ${name},` : 'Hi,';

  const categoryRows = categories
    .sort((a, b) => b.percentUsed - a.percentUsed)
    .map((c) => {
      const isOver = c.percentUsed >= 100;
      const barColor = isOver ? '#ef4444' : '#f59e0b';
      const barWidth = Math.min(100, c.percentUsed);

      return `
      <tr>
        <td style="padding: 12px 0; border-bottom: 1px solid #f3f4f6;">
          <div style="color: #18181b; font-size: 15px; margin-bottom: 6px;">
            ${c.name}
            <span style="color: ${isOver ? '#ef4444' : '#f59e0b'}; font-size: 13px; font-weight: 600; margin-left: 8px;">
              ${c.percentUsed}%
            </span>
          </div>
          <div style="background-color: #f3f4f6; border-radius: 4px; height: 8px; overflow: hidden;">
            <div style="background-color: ${barColor}; height: 100%; width: ${barWidth}%; border-radius: 4px;"></div>
          </div>
          <div style="color: #71717a; font-size: 13px; margin-top: 4px;">
            ${formatCents(c.spentCents)} of ${formatCents(c.budgetCents)}
          </div>
        </td>
      </tr>`;
    })
    .join('');

  const overCount = categories.filter((c) => c.percentUsed >= 100).length;
  const nearCount = categories.filter(
    (c) => c.percentUsed >= 80 && c.percentUsed < 100
  ).length;

  let summary = '';
  if (overCount > 0 && nearCount > 0) {
    summary = `${overCount} over budget and ${nearCount} approaching the limit`;
  } else if (overCount > 0) {
    summary = `${overCount} categor${overCount > 1 ? 'ies' : 'y'} over budget`;
  } else {
    summary = `${nearCount} categor${nearCount > 1 ? 'ies' : 'y'} approaching the limit`;
  }

  return emailWrapper(`
    <h2 style="margin: 0 0 8px; color: #18181b; font-size: 22px; font-weight: 600;">⚠️ Budget Alert</h2>
    <p style="margin: 0 0 24px; color: #3f3f46; font-size: 15px; line-height: 1.6;">
      ${greeting} You have <strong>${summary}</strong> this month.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 24px;">
      ${categoryRows}
    </table>
    <a href="https://budgetcopilot.app/presupuesto" style="display: inline-block; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; font-size: 14px;">
      Review Budget →
    </a>
  `);
}

// ============================================================================
// WEEKLY SUMMARY
// ============================================================================

export function getWeeklySummaryEmailHtml(
  name: string | null,
  data: {
    totalIncome: number;
    totalExpenses: number;
    netSavings: number;
    transactionCount: number;
    totalBalance: number;
    upcomingBillsCount: number;
    upcomingBillsTotal: number;
    totalDebt: number;
    weekStart: string;
    weekEnd: string;
  }
): string {
  const greeting = name ? `Hi ${name},` : 'Hi,';
  const isPositive = data.netSavings >= 0;

  return emailWrapper(`
    <h2 style="margin: 0 0 8px; color: #18181b; font-size: 22px; font-weight: 600;">📊 Weekly Summary</h2>
    <p style="margin: 0 0 4px; color: #71717a; font-size: 13px;">${data.weekStart} — ${data.weekEnd}</p>
    <p style="margin: 0 0 24px; color: #3f3f46; font-size: 15px; line-height: 1.6;">
      ${greeting} Here's how your week went.
    </p>

    <!-- Key metrics -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 24px;">
      <tr>
        <td style="padding: 16px; background-color: #f0fdf4; border-radius: 8px; text-align: center; width: 33%;">
          <div style="color: #15803d; font-size: 20px; font-weight: 700;">${formatCents(data.totalIncome)}</div>
          <div style="color: #166534; font-size: 12px; font-weight: 600; margin-top: 4px;">INCOME</div>
        </td>
        <td style="width: 8px;"></td>
        <td style="padding: 16px; background-color: #fef2f2; border-radius: 8px; text-align: center; width: 33%;">
          <div style="color: #dc2626; font-size: 20px; font-weight: 700;">${formatCents(data.totalExpenses)}</div>
          <div style="color: #991b1b; font-size: 12px; font-weight: 600; margin-top: 4px;">EXPENSES</div>
        </td>
        <td style="width: 8px;"></td>
        <td style="padding: 16px; background-color: ${isPositive ? '#f0fdf4' : '#fef2f2'}; border-radius: 8px; text-align: center; width: 33%;">
          <div style="color: ${isPositive ? '#15803d' : '#dc2626'}; font-size: 20px; font-weight: 700;">${isPositive ? '+' : '-'}${formatCents(data.netSavings)}</div>
          <div style="color: ${isPositive ? '#166534' : '#991b1b'}; font-size: 12px; font-weight: 600; margin-top: 4px;">NET</div>
        </td>
      </tr>
    </table>

    <!-- Details -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 24px;">
      <tr>
        <td style="padding: 12px 0; border-bottom: 1px solid #f3f4f6; color: #71717a; font-size: 14px;">Transactions this week</td>
        <td style="padding: 12px 0; border-bottom: 1px solid #f3f4f6; color: #18181b; font-size: 14px; text-align: right; font-weight: 600;">${data.transactionCount}</td>
      </tr>
      <tr>
        <td style="padding: 12px 0; border-bottom: 1px solid #f3f4f6; color: #71717a; font-size: 14px;">Total balance</td>
        <td style="padding: 12px 0; border-bottom: 1px solid #f3f4f6; color: #18181b; font-size: 14px; text-align: right; font-weight: 600;">${formatCents(data.totalBalance)}</td>
      </tr>
      ${
        data.upcomingBillsCount > 0
          ? `<tr>
        <td style="padding: 12px 0; border-bottom: 1px solid #f3f4f6; color: #71717a; font-size: 14px;">Bills due next week</td>
        <td style="padding: 12px 0; border-bottom: 1px solid #f3f4f6; color: #f59e0b; font-size: 14px; text-align: right; font-weight: 600;">${data.upcomingBillsCount} (${formatCents(data.upcomingBillsTotal)})</td>
      </tr>`
          : ''
      }
      ${
        data.totalDebt > 0
          ? `<tr>
        <td style="padding: 12px 0; border-bottom: 1px solid #f3f4f6; color: #71717a; font-size: 14px;">Total debt</td>
        <td style="padding: 12px 0; border-bottom: 1px solid #f3f4f6; color: #ef4444; font-size: 14px; text-align: right; font-weight: 600;">${formatCents(data.totalDebt)}</td>
      </tr>`
          : ''
      }
    </table>

    <a href="https://budgetcopilot.app/dashboard" style="display: inline-block; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; font-size: 14px;">
      Open Dashboard →
    </a>
  `);
}
