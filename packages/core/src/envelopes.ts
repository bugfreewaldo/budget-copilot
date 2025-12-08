import type { Envelope, Transaction } from './types.js';

/**
 * Envelope budgeting logic
 */

/**
 * Calculate current envelope balance based on transactions
 */
export function calculateEnvelopeBalance(
  envelope: Envelope,
  transactions: Transaction[]
): number {
  const relevantTransactions = transactions.filter(
    (txn) => txn.categoryId && envelope.categoryIds.includes(txn.categoryId)
  );

  const spent = relevantTransactions.reduce((sum, txn) => sum + txn.amount, 0);

  return envelope.budgetAmount - Math.abs(spent);
}

/**
 * Check if envelope is overspent
 */
export function isEnvelopeOverspent(
  envelope: Envelope,
  transactions: Transaction[]
): boolean {
  const balance = calculateEnvelopeBalance(envelope, transactions);
  return balance < 0;
}

/**
 * Calculate envelope utilization percentage
 */
export function calculateUtilization(
  envelope: Envelope,
  transactions: Transaction[]
): number {
  if (envelope.budgetAmount === 0) {
    return 0;
  }

  const spent = Math.abs(
    transactions
      .filter(
        (txn) => txn.categoryId && envelope.categoryIds.includes(txn.categoryId)
      )
      .reduce((sum, txn) => sum + txn.amount, 0)
  );

  return (spent / envelope.budgetAmount) * 100;
}

/**
 * Allocate funds to envelope
 */
export function allocateFunds(envelope: Envelope, amount: number): Envelope {
  return {
    ...envelope,
    currentAmount: envelope.currentAmount + amount,
  };
}

/**
 * Get envelope status
 */
export function getEnvelopeStatus(
  envelope: Envelope,
  transactions: Transaction[]
): 'healthy' | 'warning' | 'overspent' {
  const utilization = calculateUtilization(envelope, transactions);

  if (utilization > 100) {
    return 'overspent';
  } else if (utilization > 80) {
    return 'warning';
  }

  return 'healthy';
}
