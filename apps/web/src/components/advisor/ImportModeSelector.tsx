'use client';

import { Button } from '@budget-copilot/ui/button';
import type { AdvisorDocumentContext } from '@/lib/api';

/**
 * Format cents as currency string
 */
function formatCurrency(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

interface ImportModeSelectorProps {
  documentContext: AdvisorDocumentContext;
  onAnalyzeOnly: () => void;
  onReviewAndSelect: () => void;
  onImportAll: () => void;
}

/**
 * ImportModeSelector - Three-button mode selection after file processing
 *
 * Displays document stats and lets user choose:
 * - Solo analisis: Generate insights without importing
 * - Revisar y seleccionar: Open preview table to pick transactions
 * - Importar todo: Show filter panel then import matching
 */
export function ImportModeSelector({
  documentContext,
  onAnalyzeOnly,
  onReviewAndSelect,
  onImportAll,
}: ImportModeSelectorProps) {
  const { stats } = documentContext;

  // Build breakdown text
  const parts: string[] = [];
  if (stats.expenseCount > 0) {
    parts.push(`${stats.expenseCount} expenses`);
  }
  if (stats.incomeCount > 0) {
    parts.push(`${stats.incomeCount} income`);
  }
  if (stats.transferCount > 0) {
    parts.push(`${stats.transferCount} transfers`);
  }
  const breakdown = parts.join(', ');

  // Format amount range
  const minAmount = formatCurrency(Math.round(stats.amountRange.min * 100));
  const maxAmount = formatCurrency(Math.round(stats.amountRange.max * 100));
  const amountRange =
    stats.amountRange.min === stats.amountRange.max
      ? minAmount
      : `${minAmount} - ${maxAmount}`;

  // Period text
  let periodText = '';
  if (documentContext.period?.from && documentContext.period?.to) {
    periodText = ` from ${documentContext.period.from} to ${documentContext.period.to}`;
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <div className="mb-4 space-y-2">
        <p className="text-sm text-gray-700 dark:text-gray-300">
          <span className="font-medium">Done</span> - I processed your bank
          statement{periodText}.
        </p>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Found{' '}
          <span className="font-medium">{stats.totalCount} transactions</span> (
          {amountRange}): {breakdown}.
        </p>
        {stats.uncategorizedCount > 0 && (
          <p className="text-xs text-amber-600 dark:text-amber-400">
            {stats.uncategorizedCount} transactions with no detected category.
          </p>
        )}
      </div>

      <p className="mb-3 text-sm font-medium text-gray-700 dark:text-gray-300">
        What would you like to do with this?
      </p>

      <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
        <Button variant="outline" onClick={onAnalyzeOnly} className="flex-1">
          <div className="flex flex-col items-center">
            <span>Analysis only</span>
            <span className="text-xs text-gray-500">No import</span>
          </div>
        </Button>

        <Button
          variant="primary"
          onClick={onReviewAndSelect}
          className="flex-1"
        >
          <div className="flex flex-col items-center">
            <span>Review and select</span>
            <span className="text-xs opacity-80">Recommended</span>
          </div>
        </Button>

        <Button variant="outline" onClick={onImportAll} className="flex-1">
          <div className="flex flex-col items-center">
            <span>Import all</span>
            <span className="text-xs text-gray-500">With filters</span>
          </div>
        </Button>
      </div>
    </div>
  );
}
