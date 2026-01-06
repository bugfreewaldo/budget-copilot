/**
 * Transfer Detector
 *
 * Detects matching credit/debit pairs that are likely transfers between accounts.
 * Uses amount matching and date proximity to identify transfers.
 */

import type { ParsedTransactionRow } from '../file-upload/types';
import type { TransferPair } from './types';

/**
 * Configuration for transfer detection
 */
const TRANSFER_CONFIG = {
  // Maximum days between matching transactions to consider them a transfer
  maxDaysDiff: 3,
  // Confidence scores based on date proximity
  confidenceByDays: {
    0: 1.0, // Same day
    1: 0.9, // 1 day apart
    2: 0.8, // 2 days apart
    3: 0.7, // 3 days apart
  } as Record<number, number>,
};

/**
 * Calculate the difference in days between two dates
 */
function daysDiff(date1: string | null, date2: string | null): number | null {
  if (!date1 || !date2) return null;

  const d1 = new Date(date1);
  const d2 = new Date(date2);

  if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return null;

  const diffTime = Math.abs(d2.getTime() - d1.getTime());
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Round amount to 2 decimal places for comparison
 */
function roundAmount(amount: number): number {
  return Math.round(Math.abs(amount) * 100) / 100;
}

/**
 * Detect transfer pairs in a list of transactions
 *
 * A transfer is detected when:
 * 1. A credit and debit have the same absolute amount
 * 2. They occur within 3 days of each other
 *
 * @param transactions - Parsed transactions to analyze
 * @returns Array of detected transfer pairs
 */
export function detectTransfers(
  transactions: ParsedTransactionRow[]
): TransferPair[] {
  const pairs: TransferPair[] = [];
  const usedIds = new Set<string>();

  // Group transactions by rounded absolute amount
  const byAmount = new Map<number, ParsedTransactionRow[]>();

  for (const tx of transactions) {
    const rounded = roundAmount(tx.amount);
    const existing = byAmount.get(rounded) || [];
    existing.push(tx);
    byAmount.set(rounded, existing);
  }

  // Find matching pairs for each amount group
  for (const [amount, txns] of byAmount) {
    // Skip if only one transaction with this amount
    if (txns.length < 2) continue;

    // Separate credits and debits
    const credits = txns.filter((t) => t.isCredit && !usedIds.has(t.id));
    const debits = txns.filter((t) => !t.isCredit && !usedIds.has(t.id));

    // Match credits with debits
    for (const credit of credits) {
      if (usedIds.has(credit.id)) continue;

      for (const debit of debits) {
        if (usedIds.has(debit.id)) continue;

        // Check date proximity
        const diff = daysDiff(credit.date, debit.date);

        // If no dates, assume same day (common in some exports)
        const effectiveDiff = diff ?? 0;

        if (effectiveDiff <= TRANSFER_CONFIG.maxDaysDiff) {
          // Calculate confidence based on date proximity
          const confidence =
            TRANSFER_CONFIG.confidenceByDays[effectiveDiff] ?? 0.6;

          pairs.push({
            creditId: credit.id,
            debitId: debit.id,
            amount,
            confidence,
          });

          // Mark both as used
          usedIds.add(credit.id);
          usedIds.add(debit.id);
          break; // Move to next credit
        }
      }
    }
  }

  // Sort by confidence (highest first)
  pairs.sort((a, b) => b.confidence - a.confidence);

  return pairs;
}

/**
 * Get all transaction IDs that are part of transfer pairs
 */
export function getTransferIds(pairs: TransferPair[]): Set<string> {
  const ids = new Set<string>();
  for (const pair of pairs) {
    ids.add(pair.creditId);
    ids.add(pair.debitId);
  }
  return ids;
}

/**
 * Check if a transaction is part of a transfer
 */
export function isTransfer(
  transactionId: string,
  pairs: TransferPair[]
): boolean {
  return pairs.some(
    (p) => p.creditId === transactionId || p.debitId === transactionId
  );
}

/**
 * Get the matching transaction ID for a transfer
 */
export function getMatchedTransferId(
  transactionId: string,
  pairs: TransferPair[]
): string | undefined {
  for (const pair of pairs) {
    if (pair.creditId === transactionId) return pair.debitId;
    if (pair.debitId === transactionId) return pair.creditId;
  }
  return undefined;
}
