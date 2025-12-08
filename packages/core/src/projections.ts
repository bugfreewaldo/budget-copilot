import type { Transaction, MonthlyVariance, ProjectionResult } from './types.js';

/**
 * Budget projections and variance analysis
 */

/**
 * Calculate monthly variance between budgeted and actual spending
 */
export function calculateMonthlyVariance(
  budgeted: number,
  transactions: Transaction[],
  month: Date
): MonthlyVariance {
  const monthStart = new Date(month.getFullYear(), month.getMonth(), 1);
  const monthEnd = new Date(month.getFullYear(), month.getMonth() + 1, 0);

  const monthTransactions = transactions.filter(
    (txn) => txn.date >= monthStart && txn.date <= monthEnd
  );

  const actual = Math.abs(
    monthTransactions.reduce((sum, txn) => sum + txn.amount, 0)
  );

  const variance = budgeted - actual;
  const variancePercent = budgeted > 0 ? (variance / budgeted) * 100 : 0;

  return {
    month: month.toISOString().slice(0, 7), // YYYY-MM format
    budgeted,
    actual,
    variance,
    variancePercent,
  };
}

/**
 * Simple linear projection based on historical averages
 */
export function projectSpending(
  historicalTransactions: Transaction[],
  periodsAhead: number = 3
): ProjectionResult[] {
  if (historicalTransactions.length === 0) {
    return [];
  }

  // Group transactions by month
  const monthlyTotals = new Map<string, number>();

  for (const txn of historicalTransactions) {
    const monthKey = txn.date.toISOString().slice(0, 7);
    const current = monthlyTotals.get(monthKey) || 0;
    monthlyTotals.set(monthKey, current + Math.abs(txn.amount));
  }

  const totals = Array.from(monthlyTotals.values());
  const average = totals.reduce((sum, val) => sum + val, 0) / totals.length;

  // Calculate trend
  const firstHalf = totals.slice(0, Math.floor(totals.length / 2));
  const secondHalf = totals.slice(Math.floor(totals.length / 2));

  const firstAvg =
    firstHalf.reduce((sum, val) => sum + val, 0) / firstHalf.length;
  const secondAvg =
    secondHalf.reduce((sum, val) => sum + val, 0) / secondHalf.length;

  let trend: 'increasing' | 'decreasing' | 'stable' = 'stable';
  const trendDiff = ((secondAvg - firstAvg) / firstAvg) * 100;

  if (Math.abs(trendDiff) < 5) {
    trend = 'stable';
  } else if (trendDiff > 0) {
    trend = 'increasing';
  } else {
    trend = 'decreasing';
  }

  // Generate projections
  const projections: ProjectionResult[] = [];
  const lastDate = new Date(
    Math.max(...historicalTransactions.map((t) => t.date.getTime()))
  );

  for (let i = 1; i <= periodsAhead; i++) {
    const projectedDate = new Date(
      lastDate.getFullYear(),
      lastDate.getMonth() + i,
      1
    );

    const trendMultiplier =
      trend === 'stable' ? 1 : trend === 'increasing' ? 1.05 : 0.95;
    const projected = average * Math.pow(trendMultiplier, i);

    // Confidence decreases with time
    const confidence = Math.max(0.5, 1 - i * 0.1);

    projections.push({
      period: projectedDate.toISOString().slice(0, 7),
      projected: Math.round(projected * 100) / 100,
      confidence,
      trend,
    });
  }

  return projections;
}

/**
 * Detect spending anomalies (transactions significantly above average)
 */
export function detectAnomalies(
  transactions: Transaction[],
  threshold: number = 2.0
): Transaction[] {
  if (transactions.length < 3) {
    return [];
  }

  const amounts = transactions.map((t) => Math.abs(t.amount));
  const mean = amounts.reduce((sum, val) => sum + val, 0) / amounts.length;

  // Calculate standard deviation
  const variance =
    amounts.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
    amounts.length;
  const stdDev = Math.sqrt(variance);

  return transactions.filter((txn) => {
    const zScore = Math.abs((Math.abs(txn.amount) - mean) / stdDev);
    return zScore > threshold;
  });
}
