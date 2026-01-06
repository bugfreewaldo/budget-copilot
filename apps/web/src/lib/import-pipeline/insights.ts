/**
 * Insights Generator
 *
 * Generates spending analysis, recurring patterns, and anomaly detection
 * from enriched transactions.
 */

import type {
  EnrichedTransaction,
  ImportStats,
  ImportInsights,
  CategorySpending,
  RecurringPattern,
  TransactionAnomaly,
} from './types';

/**
 * Normalize description for pattern matching
 */
function normalizeDescription(desc: string): string {
  return desc
    .toLowerCase()
    .replace(/[0-9]+/g, '') // Remove numbers
    .replace(/[^a-z\s]/g, '') // Remove special chars
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
}

/**
 * Calculate spending by category
 */
function calculateSpendingByCategory(
  transactions: EnrichedTransaction[],
  isExpense: boolean
): CategorySpending[] {
  const byCategory = new Map<string, { totalCents: number; count: number }>();

  for (const tx of transactions) {
    // Filter by type
    if (isExpense && tx.isCredit) continue;
    if (!isExpense && !tx.isCredit) continue;

    // Skip transfers
    if (tx.isTransfer) continue;

    const categoryName = tx.category.name || 'Sin categoría';
    const amountCents = Math.round(Math.abs(tx.amount) * 100);

    const existing = byCategory.get(categoryName) || {
      totalCents: 0,
      count: 0,
    };
    existing.totalCents += amountCents;
    existing.count++;
    byCategory.set(categoryName, existing);
  }

  // Convert to array and calculate percentages
  const total = Array.from(byCategory.values()).reduce(
    (sum, cat) => sum + cat.totalCents,
    0
  );

  const result: CategorySpending[] = Array.from(byCategory.entries())
    .map(([name, data]) => ({
      categoryName: name,
      categoryId: null, // We don't have IDs in local enrichment
      totalCents: data.totalCents,
      transactionCount: data.count,
      percentage: total > 0 ? (data.totalCents / total) * 100 : 0,
    }))
    .sort((a, b) => b.totalCents - a.totalCents);

  return result;
}

/**
 * Find largest transactions
 */
function findLargestTransactions(
  transactions: EnrichedTransaction[],
  isExpense: boolean,
  limit: number = 5
): Array<{
  id: string;
  description: string;
  amountCents: number;
  date: string | null;
  categoryName: string | null;
}> {
  return transactions
    .filter((tx) => {
      if (tx.isTransfer) return false;
      if (isExpense) return !tx.isCredit;
      return tx.isCredit;
    })
    .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))
    .slice(0, limit)
    .map((tx) => ({
      id: tx.id,
      description: tx.description,
      amountCents: Math.round(Math.abs(tx.amount) * 100),
      date: tx.date,
      categoryName: tx.category.name,
    }));
}

/**
 * Detect recurring transaction patterns
 */
function detectRecurringPatterns(
  transactions: EnrichedTransaction[]
): RecurringPattern[] {
  // Group by normalized description
  const byDescription = new Map<
    string,
    Array<{ tx: EnrichedTransaction; normalized: string }>
  >();

  for (const tx of transactions) {
    if (tx.isTransfer) continue;

    const normalized = normalizeDescription(tx.description);
    if (normalized.length < 3) continue; // Skip very short descriptions

    const existing = byDescription.get(normalized) || [];
    existing.push({ tx, normalized });
    byDescription.set(normalized, existing);
  }

  const patterns: RecurringPattern[] = [];

  for (const [normalized, items] of byDescription) {
    // Need at least 2 occurrences
    if (items.length < 2) continue;

    // Calculate average amount
    const amounts = items.map((i) => Math.abs(i.tx.amount));
    const avgAmount = amounts.reduce((a, b) => a + b, 0) / amounts.length;

    // Check if amounts are similar (within 20%)
    const amountVariance = amounts.every(
      (a) => Math.abs(a - avgAmount) / avgAmount < 0.2
    );

    if (!amountVariance) continue;

    // Determine frequency based on date intervals
    const dates = items
      .map((i) => i.tx.date)
      .filter((d): d is string => d !== null)
      .sort();

    let frequency: 'weekly' | 'biweekly' | 'monthly' | 'irregular' =
      'irregular';

    if (dates.length >= 2) {
      // Calculate average interval in days
      let totalDays = 0;
      for (let i = 1; i < dates.length; i++) {
        const prevDate = dates[i - 1];
        const currDate = dates[i];
        if (prevDate && currDate) {
          const d1 = new Date(prevDate);
          const d2 = new Date(currDate);
          totalDays += (d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24);
        }
      }
      const avgDays = totalDays / (dates.length - 1);

      if (avgDays >= 5 && avgDays <= 9) frequency = 'weekly';
      else if (avgDays >= 12 && avgDays <= 18) frequency = 'biweekly';
      else if (avgDays >= 25 && avgDays <= 35) frequency = 'monthly';
    }

    // Use the original description from the first occurrence
    const firstItem = items[0];
    if (!firstItem) continue;
    const originalDescription = firstItem.tx.description;
    const isExpense = !firstItem.tx.isCredit;

    patterns.push({
      description: originalDescription,
      normalizedDescription: normalized,
      avgAmountCents: Math.round(avgAmount * 100),
      frequency,
      occurrences: items.length,
      dates,
      isExpense,
    });
  }

  // Sort by occurrences (most frequent first)
  return patterns.sort((a, b) => b.occurrences - a.occurrences);
}

/**
 * Detect anomalies in transactions
 */
function detectAnomalies(
  transactions: EnrichedTransaction[],
  _stats: ImportStats
): TransactionAnomaly[] {
  const anomalies: TransactionAnomaly[] = [];

  // Calculate thresholds
  const amounts = transactions
    .filter((tx) => !tx.isTransfer && !tx.isCredit)
    .map((tx) => Math.abs(tx.amount));

  if (amounts.length < 3) return anomalies;

  const sorted = [...amounts].sort((a, b) => a - b);
  const medianValue = sorted[Math.floor(sorted.length / 2)] ?? 0;
  const avgAmount = amounts.reduce((a, b) => a + b, 0) / amounts.length;

  // Threshold for "unusually high" = 3x median or 2x average
  const highThreshold = Math.max(medianValue * 3, avgAmount * 2);

  // Track descriptions for duplicate detection
  const descriptionCounts = new Map<string, EnrichedTransaction[]>();

  for (const tx of transactions) {
    if (tx.isTransfer) continue;

    const absAmount = Math.abs(tx.amount);
    const amountCents = Math.round(absAmount * 100);

    // Check for unusually high amounts
    if (!tx.isCredit && absAmount > highThreshold && absAmount > 100) {
      anomalies.push({
        transactionId: tx.id,
        description: tx.description,
        amountCents,
        date: tx.date,
        reason: 'unusually_high',
        details:
          medianValue > 0
            ? `${(absAmount / medianValue).toFixed(1)}x el gasto típico`
            : 'Monto inusualmente alto',
      });
    }

    // Check for round numbers (potential manual entries or fees)
    if (absAmount >= 100 && absAmount % 100 === 0) {
      // Only flag if it's a "suspicious" round number
      if (absAmount >= 500) {
        anomalies.push({
          transactionId: tx.id,
          description: tx.description,
          amountCents,
          date: tx.date,
          reason: 'round_number',
          details: 'Cantidad redonda (posible cargo manual)',
        });
      }
    }

    // Track for duplicate detection
    const normalized = normalizeDescription(tx.description);
    const existing = descriptionCounts.get(normalized) || [];
    existing.push(tx);
    descriptionCounts.set(normalized, existing);
  }

  // Check for potential duplicates (same description, same amount, same date)
  for (const [, txns] of descriptionCounts) {
    if (txns.length < 2) continue;

    // Group by date and amount
    const byDateAmount = new Map<string, EnrichedTransaction[]>();
    for (const tx of txns) {
      const key = `${tx.date || 'nodate'}-${Math.round(Math.abs(tx.amount) * 100)}`;
      const existing = byDateAmount.get(key) || [];
      existing.push(tx);
      byDateAmount.set(key, existing);
    }

    for (const [, duplicates] of byDateAmount) {
      if (duplicates.length > 1) {
        // Flag all but the first as potential duplicates
        for (let i = 1; i < duplicates.length; i++) {
          const tx = duplicates[i];
          if (!tx) continue;
          anomalies.push({
            transactionId: tx.id,
            description: tx.description,
            amountCents: Math.round(Math.abs(tx.amount) * 100),
            date: tx.date,
            reason: 'potential_duplicate',
            details: 'Posible duplicado (mismo monto y fecha)',
          });
        }
      }
    }
  }

  return anomalies;
}

/**
 * Generate full insights from enriched transactions
 */
export function generateInsights(
  transactions: EnrichedTransaction[],
  stats: ImportStats
): ImportInsights {
  return {
    spendingByCategory: calculateSpendingByCategory(transactions, true),
    incomeByCategory: calculateSpendingByCategory(transactions, false),
    largestExpenses: findLargestTransactions(transactions, true, 5),
    largestIncome: findLargestTransactions(transactions, false, 5),
    recurringPatterns: detectRecurringPatterns(transactions),
    anomalies: detectAnomalies(transactions, stats),
  };
}
