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
          avalanche: {
            totalInterestCents: 0,
            monthsToPayoff: 0,
            order: [],
          },
          snowball: {
            totalInterestCents: 0,
            monthsToPayoff: 0,
            order: [],
          },
          recommendation: 'avalanche' as const,
          savingsWithAvalanche: 0,
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

      // Simple amortization calculation (max 480 months = 40 years for long mortgages)
      while (balance > 0 && months < 480) {
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

    const avalancheResults = avalancheOrder.map((d, i) =>
      calculatePayoffInfo(d, i)
    );
    const snowballResults = snowballOrder.map((d, i) =>
      calculatePayoffInfo(d, i)
    );

    const avalancheTotalInterestCents = avalancheResults.reduce(
      (sum, d) => sum + d.totalInterestCents,
      0
    );
    const snowballTotalInterestCents = snowballResults.reduce(
      (sum, d) => sum + d.totalInterestCents,
      0
    );

    const avalancheMonthsToPayoff = Math.max(
      ...avalancheResults.map((d) => d.monthsToPayoff),
      0
    );
    const snowballMonthsToPayoff = Math.max(
      ...snowballResults.map((d) => d.monthsToPayoff),
      0
    );

    // Recommend avalanche if it saves significant interest, otherwise snowball for motivation
    const recommendation: 'avalanche' | 'snowball' =
      avalancheTotalInterestCents < snowballTotalInterestCents
        ? 'avalanche'
        : 'snowball';

    const savingsWithAvalanche = Math.max(
      0,
      snowballTotalInterestCents - avalancheTotalInterestCents
    );

    return NextResponse.json({
      data: {
        avalanche: {
          totalInterestCents: avalancheTotalInterestCents,
          monthsToPayoff: avalancheMonthsToPayoff,
          order: avalancheResults.map((d) => ({
            id: d.id,
            name: d.name,
            balance: d.currentBalanceCents,
            apr: d.aprPercent,
          })),
        },
        snowball: {
          totalInterestCents: snowballTotalInterestCents,
          monthsToPayoff: snowballMonthsToPayoff,
          order: snowballResults.map((d) => ({
            id: d.id,
            name: d.name,
            balance: d.currentBalanceCents,
            apr: d.aprPercent,
          })),
        },
        recommendation,
        savingsWithAvalanche,
      },
    });
  } catch (error) {
    console.error('Failed to calculate strategies:', error);
    return errorJson('INTERNAL_ERROR', 'Failed to calculate strategies', 500);
  }
}
