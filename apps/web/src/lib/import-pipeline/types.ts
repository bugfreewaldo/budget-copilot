/**
 * Import Pipeline Types
 *
 * Shared types for the premium import pipeline feature.
 */

import type { ParsedTransactionRow } from '../file-upload/types';

/**
 * Enriched transaction with category confidence and transfer detection
 */
export interface EnrichedTransaction {
  id: string;
  date: string | null;
  description: string;
  amount: number;
  isCredit: boolean;
  category: {
    id: string | null;
    name: string | null;
    confidence: number; // 0.0 - 1.0
    source: 'pattern' | 'ai' | 'none';
  };
  isTransfer: boolean;
  matchedTransferId?: string;
}

/**
 * A detected transfer pair (matching credit and debit)
 */
export interface TransferPair {
  creditId: string;
  debitId: string;
  amount: number;
  confidence: number; // 0.0 - 1.0 (same day = 1.0, 1 day = 0.9, 2-3 days = 0.7)
}

/**
 * Filter state for import preview
 */
export interface ImportFilters {
  excludeTransfers: boolean;
  typeFilter: 'all' | 'income' | 'expense';
  excludeMicroFees: boolean; // < $1
  minAmount: number;
  maxAmount: number | null;
  dateRange: {
    from: string | null;
    to: string | null;
  };
  confidenceFilter: 'all' | 'high' | 'low' | 'uncategorized';
}

/**
 * Default filter values
 */
export const DEFAULT_IMPORT_FILTERS: ImportFilters = {
  excludeTransfers: true,
  typeFilter: 'all',
  excludeMicroFees: true,
  minAmount: 0,
  maxAmount: null,
  dateRange: { from: null, to: null },
  confidenceFilter: 'all',
};

/**
 * Statistics about the import
 */
export interface ImportStats {
  totalCount: number;
  incomeCount: number;
  expenseCount: number;
  transferCount: number;
  uncategorizedCount: number;
  lowConfidenceCount: number;
  microFeeCount: number; // < $1
  dateRange: {
    from: string | null;
    to: string | null;
  };
  amountRange: {
    min: number;
    max: number;
  };
  totalIncomeCents: number;
  totalExpenseCents: number;
}

/**
 * Spending breakdown by category
 */
export interface CategorySpending {
  categoryName: string;
  categoryId: string | null;
  totalCents: number;
  transactionCount: number;
  percentage: number;
}

/**
 * A detected recurring pattern
 */
export interface RecurringPattern {
  description: string;
  normalizedDescription: string;
  avgAmountCents: number;
  frequency: 'weekly' | 'biweekly' | 'monthly' | 'irregular';
  occurrences: number;
  dates: string[];
  isExpense: boolean;
}

/**
 * An anomaly / unusual transaction
 */
export interface TransactionAnomaly {
  transactionId: string;
  description: string;
  amountCents: number;
  date: string | null;
  reason:
    | 'unusually_high'
    | 'unusually_low'
    | 'round_number'
    | 'potential_duplicate';
  details?: string;
}

/**
 * Full insights generated from analysis
 */
export interface ImportInsights {
  spendingByCategory: CategorySpending[];
  incomeByCategory: CategorySpending[];
  largestExpenses: Array<{
    id: string;
    description: string;
    amountCents: number;
    date: string | null;
    categoryName: string | null;
  }>;
  largestIncome: Array<{
    id: string;
    description: string;
    amountCents: number;
    date: string | null;
    categoryName: string | null;
  }>;
  recurringPatterns: RecurringPattern[];
  anomalies: TransactionAnomaly[];
}

/**
 * Complete enrichment result
 */
export interface EnrichmentResult {
  transactions: EnrichedTransaction[];
  transferPairs: TransferPair[];
  stats: ImportStats;
  insights: ImportInsights;
}

/**
 * Document context returned after file processing
 */
export interface DocumentContext {
  fileId: string;
  documentType: 'bank_statement' | 'receipt' | 'invoice';
  accountName?: string | null;
  period?: {
    from: string | null;
    to: string | null;
  };
  stats: ImportStats;
  // Full enrichment data (for use by components)
  enrichment?: EnrichmentResult;
}

/**
 * Input for enrichment (parsed transactions)
 */
export type EnrichmentInput = ParsedTransactionRow[];

/**
 * Apply filters to enriched transactions
 */
export function applyFilters(
  transactions: EnrichedTransaction[],
  filters: ImportFilters
): EnrichedTransaction[] {
  return transactions.filter((tx) => {
    // Exclude transfers
    if (filters.excludeTransfers && tx.isTransfer) {
      return false;
    }

    // Type filter
    if (filters.typeFilter === 'income' && !tx.isCredit) {
      return false;
    }
    if (filters.typeFilter === 'expense' && tx.isCredit) {
      return false;
    }

    // Exclude micro-fees
    if (filters.excludeMicroFees && Math.abs(tx.amount) < 1) {
      return false;
    }

    // Amount range
    const absAmount = Math.abs(tx.amount);
    if (absAmount < filters.minAmount) {
      return false;
    }
    if (filters.maxAmount !== null && absAmount > filters.maxAmount) {
      return false;
    }

    // Date range
    if (tx.date) {
      if (filters.dateRange.from && tx.date < filters.dateRange.from) {
        return false;
      }
      if (filters.dateRange.to && tx.date > filters.dateRange.to) {
        return false;
      }
    }

    // Confidence filter
    if (filters.confidenceFilter === 'high' && tx.category.confidence < 0.7) {
      return false;
    }
    if (filters.confidenceFilter === 'low' && tx.category.confidence >= 0.7) {
      return false;
    }
    if (
      filters.confidenceFilter === 'uncategorized' &&
      tx.category.id !== null
    ) {
      return false;
    }

    return true;
  });
}
