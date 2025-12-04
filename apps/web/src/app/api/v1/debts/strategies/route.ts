import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { debts } from '@/lib/db/schema';
import { json, errorJson } from '@/lib/api/utils';

interface DebtForStrategy {
  id: string;
  name: string;
  currentBalanceCents: number;
  aprPercent: number;
  minimumPaymentCents: number | null;
}

/**
 * Calculate payoff with a given strategy
 */
function calculatePayoff(
  debtList: DebtForStrategy[],
  extraPayment: number = 0
): { totalInterestCents: number; monthsToPayoff: number } {
  if (debtList.length === 0) {
    return { totalInterestCents: 0, monthsToPayoff: 0 };
  }

  // Clone debts with balances
  const workingDebts = debtList.map((d) => ({
    ...d,
    balance: d.currentBalanceCents,
    minPayment:
      d.minimumPaymentCents || Math.round(d.currentBalanceCents * 0.02),
  }));

  let totalInterest = 0;
  let months = 0;
  const maxMonths = 360;

  while (workingDebts.some((d) => d.balance > 0) && months < maxMonths) {
    months++;

    // Apply interest and minimum payments to all debts
    let extraAvailable = extraPayment;

    for (const debt of workingDebts) {
      if (debt.balance <= 0) continue;

      // Monthly interest
      const monthlyRate = debt.aprPercent / 100 / 12;
      const interest = Math.round(debt.balance * monthlyRate);
      totalInterest += interest;
      debt.balance += interest;

      // Pay minimum
      const minPay = Math.min(debt.minPayment, debt.balance);
      debt.balance -= minPay;
    }

    // Apply extra payment to first debt with balance (already sorted by strategy)
    for (const debt of workingDebts) {
      if (debt.balance > 0 && extraAvailable > 0) {
        const extraPay = Math.min(extraAvailable, debt.balance);
        debt.balance -= extraPay;
        extraAvailable -= extraPay;
        break;
      }
    }
  }

  return { totalInterestCents: totalInterest, monthsToPayoff: months };
}

/**
 * GET /api/v1/debts/strategies - Get debt payoff strategies
 */
export async function GET() {
  try {
    const db = getDb();
    const userId = 'test-user-00000000000000000001';

    const userDebts = await db
      .select()
      .from(debts)
      .where(eq(debts.userId, userId));

    const activeDebts = userDebts.filter((d) => d.status === 'active');

    if (activeDebts.length === 0) {
      return json({
        data: {
          avalanche: { totalInterestCents: 0, monthsToPayoff: 0, order: [] },
          snowball: { totalInterestCents: 0, monthsToPayoff: 0, order: [] },
          recommendation: 'avalanche' as const,
          savingsWithAvalanche: 0,
        },
      });
    }

    // Avalanche: highest APR first
    const avalancheOrder = [...activeDebts].sort(
      (a, b) => b.aprPercent - a.aprPercent
    );
    const avalanche = calculatePayoff(avalancheOrder);

    // Snowball: lowest balance first
    const snowballOrder = [...activeDebts].sort(
      (a, b) => a.currentBalanceCents - b.currentBalanceCents
    );
    const snowball = calculatePayoff(snowballOrder);

    const savingsWithAvalanche =
      snowball.totalInterestCents - avalanche.totalInterestCents;

    return json({
      data: {
        avalanche: {
          ...avalanche,
          order: avalancheOrder.map((d) => ({
            id: d.id,
            name: d.name,
            balance: d.currentBalanceCents,
            apr: d.aprPercent,
          })),
        },
        snowball: {
          ...snowball,
          order: snowballOrder.map((d) => ({
            id: d.id,
            name: d.name,
            balance: d.currentBalanceCents,
            apr: d.aprPercent,
          })),
        },
        recommendation:
          savingsWithAvalanche > 0
            ? ('avalanche' as const)
            : ('snowball' as const),
        savingsWithAvalanche: Math.max(0, savingsWithAvalanche),
      },
    });
  } catch (error) {
    console.error('Failed to calculate strategies:', error);
    return errorJson('DB_ERROR', 'Failed to calculate strategies', 500, {
      error: (error as Error).message,
    });
  }
}
