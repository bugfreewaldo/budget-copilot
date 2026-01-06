'use client';

import { Button } from '@budget-copilot/ui/button';
import type { AdvisorDocumentContext } from '@/lib/api';

/**
 * Format cents as currency string
 */
function formatCurrency(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

type EnrichedTransaction = NonNullable<
  AdvisorDocumentContext['enrichment']
>['transactions'][number];

interface ImportStagingCardProps {
  selectedTransactions: EnrichedTransaction[];
  originalStats: {
    totalCount: number;
    transferCount: number;
    microFeeCount: number;
  };
  isLoading: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

/**
 * ImportStagingCard - Shows staged changes before confirmation
 *
 * Displays:
 * - Number of transactions to import
 * - Exclusions (transfers, micro-fees)
 * - Cancel / Confirm buttons
 */
export function ImportStagingCard({
  selectedTransactions,
  originalStats,
  isLoading,
  onCancel,
  onConfirm,
}: ImportStagingCardProps) {
  // Calculate stats
  let expenseCount = 0;
  let incomeCount = 0;
  let expenseCents = 0;
  let incomeCents = 0;
  let transfersExcluded = 0;
  let microFeesExcluded = 0;

  for (const tx of selectedTransactions) {
    const amountCents = Math.round(Math.abs(tx.amount) * 100);
    if (tx.isCredit) {
      incomeCount++;
      incomeCents += amountCents;
    } else {
      expenseCount++;
      expenseCents += amountCents;
    }
  }

  // Calculate exclusions
  const excludedCount = originalStats.totalCount - selectedTransactions.length;
  // We don't have access to original transactions here, so we show the count from stats
  transfersExcluded = Math.min(originalStats.transferCount, excludedCount);
  microFeesExcluded = Math.min(
    originalStats.microFeeCount,
    excludedCount - transfersExcluded
  );

  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-900/50 dark:bg-blue-900/20">
      <h3 className="mb-3 text-sm font-medium text-gray-900 dark:text-white">
        Cambios a aplicar
      </h3>

      <div className="mb-4 space-y-1 text-sm">
        <p className="text-gray-700 dark:text-gray-300">
          <span className="font-medium">{selectedTransactions.length}</span>{' '}
          transacciones nuevas
        </p>

        {expenseCount > 0 && (
          <p className="ml-3 text-gray-600 dark:text-gray-400">
            <span className="text-red-600 dark:text-red-400">
              {expenseCount} gastos
            </span>{' '}
            ({formatCurrency(expenseCents)})
          </p>
        )}

        {incomeCount > 0 && (
          <p className="ml-3 text-gray-600 dark:text-gray-400">
            <span className="text-green-600 dark:text-green-400">
              {incomeCount} ingresos
            </span>{' '}
            ({formatCurrency(incomeCents)})
          </p>
        )}

        {transfersExcluded > 0 && (
          <p className="text-gray-500 dark:text-gray-500">
            {transfersExcluded} transferencias excluidas
          </p>
        )}

        {microFeesExcluded > 0 && (
          <p className="text-gray-500 dark:text-gray-500">
            {microFeesExcluded} micro-cargos excluidos
          </p>
        )}
      </div>

      <div className="flex gap-2">
        <Button
          variant="outline"
          onClick={onCancel}
          disabled={isLoading}
          className="flex-1"
        >
          Cancelar
        </Button>
        <Button
          variant="primary"
          onClick={onConfirm}
          disabled={isLoading || selectedTransactions.length === 0}
          className="flex-1"
        >
          {isLoading ? 'Importando...' : 'Confirmar importacion'}
        </Button>
      </div>
    </div>
  );
}
