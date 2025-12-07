import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { debts } from '@/lib/db/schema';
import { getAuthenticatedUser } from '@/lib/api/auth';
import { errorJson } from '@/lib/api/utils';

export const dynamic = 'force-dynamic';

interface DebtWithPayoff {
  id: string;
  name: string;
  currentBalanceCents: number;
  aprPercent: number;
  minimumPaymentCents: number;
  monthsToPayoff: number;
  totalInterestCents: number;
  payoffOrder: number;
}

/**
 * GET /api/v1/debts/strategies - Get debt payoff strategies
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(request);
    if (!auth.success) return auth.response;

    const db = getDb();

    const userDebts = await db
      .select()
      .from(debts)
      .where(eq(debts.userId, auth.user.id));

    const activeDebts = userDebts.filter(
      (d) => d.status === 'active' && d.currentBalanceCents > 0
    );

    if (activeDebts.length === 0) {
      return NextResponse.json({
        data: {
          avalanche: [],
          snowball: [],
          summary: {
            totalDebtCents: 0,
            totalMinimumPaymentCents: 0,
          },
        },
      });
    }

    // Avalanche: highest APR first
    const avalancheOrder = [...activeDebts].sort(
      (a, b) => b.aprPercent - a.aprPercent
    );

    // Snowball: lowest balance first
    const snowballOrder = [...activeDebts].sort(
      (a, b) => a.currentBalanceCents - b.currentBalanceCents
    );

    const calculatePayoffInfo = (
      debt: (typeof activeDebts)[0],
      order: number
    ): DebtWithPayoff => {
      const monthlyRate = debt.aprPercent / 100 / 12;
      const minPayment =
        debt.minimumPaymentCents || Math.ceil(debt.currentBalanceCents * 0.02);

      let balance = debt.currentBalanceCents;
      let months = 0;
      let totalInterest = 0;

      // Simple amortization calculation
      while (balance > 0 && months < 360) {
        const interest = Math.round(balance * monthlyRate);
        totalInterest += interest;
        balance = balance + interest - minPayment;
        months++;
      }

      return {
        id: debt.id,
        name: debt.name,
        currentBalanceCents: debt.currentBalanceCents,
        aprPercent: debt.aprPercent,
        minimumPaymentCents: minPayment,
        monthsToPayoff: months,
        totalInterestCents: totalInterest,
        payoffOrder: order + 1,
      };
    };

    const avalanche = avalancheOrder.map((d, i) => calculatePayoffInfo(d, i));
    const snowball = snowballOrder.map((d, i) => calculatePayoffInfo(d, i));

    const totalDebtCents = activeDebts.reduce(
      (sum, d) => sum + d.currentBalanceCents,
      0
    );
    const totalMinimumPaymentCents = activeDebts.reduce(
      (sum, d) =>
        sum +
        (d.minimumPaymentCents || Math.ceil(d.currentBalanceCents * 0.02)),
      0
    );

    return NextResponse.json({
      data: {
        avalanche,
        snowball,
        summary: {
          totalDebtCents,
          totalMinimumPaymentCents,
          avalancheTotalInterestCents: avalanche.reduce(
            (sum, d) => sum + d.totalInterestCents,
            0
          ),
          snowballTotalInterestCents: snowball.reduce(
            (sum, d) => sum + d.totalInterestCents,
            0
          ),
        },
      },
    });
  } catch (error) {
    console.error('Failed to calculate strategies:', error);
    return errorJson('INTERNAL_ERROR', 'Failed to calculate strategies', 500);
  }
}
