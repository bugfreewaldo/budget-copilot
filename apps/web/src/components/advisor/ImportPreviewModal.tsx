'use client';

import { useState, useMemo, useCallback } from 'react';
import { Button } from '@budget-copilot/ui/button';
import type { AdvisorDocumentContext, Category } from '@/lib/api';
import {
  ImportFilters,
  DEFAULT_IMPORT_FILTERS,
  type ImportFiltersState,
} from './ImportFilters';

/**
 * Format cents as currency string
 */
function formatCurrency(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

type EnrichedTransaction = NonNullable<
  AdvisorDocumentContext['enrichment']
>['transactions'][number];

interface ImportPreviewModalProps {
  documentContext: AdvisorDocumentContext;
  categories: Category[];
  onClose: () => void;
  onStage: (selectedTransactions: EnrichedTransaction[]) => void;
  onCategoryChange: (
    transactionId: string,
    categoryId: string | null,
    categoryName: string | null
  ) => void;
}

/**
 * ImportPreviewModal - Full-screen modal to review and select transactions
 *
 * Shows:
 * - Filter controls at the top
 * - Transaction table with checkboxes
 * - Summary of selected transactions
 * - Stage button to confirm selection
 */
export function ImportPreviewModal({
  documentContext,
  categories,
  onClose,
  onStage,
  onCategoryChange,
}: ImportPreviewModalProps) {
  const transactions = useMemo(
    () => documentContext.enrichment?.transactions ?? [],
    [documentContext.enrichment?.transactions]
  );
  const stats = documentContext.stats;

  // Filter state
  const [filters, setFilters] = useState<ImportFiltersState>(
    DEFAULT_IMPORT_FILTERS
  );

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => {
    // Start with all non-excluded transactions selected
    const initial = new Set<string>();
    for (const tx of transactions) {
      if (filters.excludeTransfers && tx.isTransfer) continue;
      if (filters.excludeMicroFees && Math.abs(tx.amount) < 1) continue;
      initial.add(tx.id);
    }
    return initial;
  });

  // Apply filters to get visible transactions
  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      if (filters.excludeTransfers && tx.isTransfer) return false;
      if (filters.excludeMicroFees && Math.abs(tx.amount) < 1) return false;
      if (filters.typeFilter === 'income' && !tx.isCredit) return false;
      if (filters.typeFilter === 'expense' && tx.isCredit) return false;
      return true;
    });
  }, [transactions, filters]);

  // Update selection when filters change
  const handleFiltersChange = useCallback(
    (newFilters: ImportFiltersState) => {
      // Capture old filters for comparison
      const oldFilters = filters;

      setFilters(newFilters);

      // Update selection based on new filters:
      // - If filters are MORE restrictive: remove items that no longer pass
      // - If filters are LESS restrictive: add newly visible items
      setSelectedIds((prev) => {
        const newSelected = new Set<string>();
        for (const tx of transactions) {
          // Check if transaction passes new filters
          const passesNewFilters = !(
            (newFilters.excludeTransfers && tx.isTransfer) ||
            (newFilters.excludeMicroFees && Math.abs(tx.amount) < 1) ||
            (newFilters.typeFilter === 'income' && !tx.isCredit) ||
            (newFilters.typeFilter === 'expense' && tx.isCredit)
          );

          // Check if transaction was visible with old filters
          const wasVisibleWithOldFilters = !(
            (oldFilters.excludeTransfers && tx.isTransfer) ||
            (oldFilters.excludeMicroFees && Math.abs(tx.amount) < 1) ||
            (oldFilters.typeFilter === 'income' && !tx.isCredit) ||
            (oldFilters.typeFilter === 'expense' && tx.isCredit)
          );

          if (passesNewFilters) {
            // Keep previously selected items + add newly visible items
            // (This effectively "selects all visible" when filters become less restrictive)
            if (prev.has(tx.id) || !wasVisibleWithOldFilters) {
              newSelected.add(tx.id);
            }
          }
        }
        return newSelected;
      });
    },
    [transactions, filters]
  );

  // Toggle individual selection
  const toggleSelection = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  // Select / deselect all visible
  const selectAll = useCallback(() => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const tx of filteredTransactions) {
        next.add(tx.id);
      }
      return next;
    });
  }, [filteredTransactions]);

  const deselectAll = useCallback(() => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const tx of filteredTransactions) {
        next.delete(tx.id);
      }
      return next;
    });
  }, [filteredTransactions]);

  // Calculate total stats (ALL transactions, ignoring filters and selection)
  const totalStats = useMemo(() => {
    let expenses = 0;
    let income = 0;

    for (const tx of transactions) {
      const amountCents = Math.round(Math.abs(tx.amount) * 100);
      if (tx.isCredit) {
        income += amountCents;
      } else {
        expenses += amountCents;
      }
    }

    return { count: transactions.length, expenses, income };
  }, [transactions]);

  // Calculate selected stats
  const selectedStats = useMemo(() => {
    let count = 0;
    let expenses = 0;
    let income = 0;

    for (const tx of transactions) {
      if (selectedIds.has(tx.id)) {
        count++;
        const amountCents = Math.round(Math.abs(tx.amount) * 100);
        if (tx.isCredit) {
          income += amountCents;
        } else {
          expenses += amountCents;
        }
      }
    }

    return { count, expenses, income };
  }, [transactions, selectedIds]);

  // Get selected transactions
  const selectedTransactions = useMemo(() => {
    return transactions.filter((tx) => selectedIds.has(tx.id));
  }, [transactions, selectedIds]);

  // All filtered selected?
  const allSelected =
    filteredTransactions.length > 0 &&
    filteredTransactions.every((tx) => selectedIds.has(tx.id));

  // Sort categories: parents first (alphabetically), then children grouped under parents
  const sortedCategories = useMemo(() => {
    const parents = categories
      .filter((c) => !c.parentId)
      .sort((a, b) => a.name.localeCompare(b.name));
    const result: Category[] = [];
    for (const parent of parents) {
      result.push(parent);
      const children = categories
        .filter((c) => c.parentId === parent.id)
        .sort((a, b) => a.name.localeCompare(b.name));
      result.push(...children);
    }
    return result;
  }, [categories]);

  // Handle category change from dropdown
  const handleCategoryDropdownChange = useCallback(
    (transactionId: string, categoryId: string) => {
      if (categoryId === '') {
        onCategoryChange(transactionId, null, null);
      } else {
        const category = categories.find((c) => c.id === categoryId);
        onCategoryChange(transactionId, categoryId, category?.name ?? null);
      }
    },
    [categories, onCategoryChange]
  );

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white dark:bg-gray-900">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-700">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          Revisar transacciones
        </h2>
        <button
          onClick={onClose}
          className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          <svg
            className="h-6 w-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      {/* Filters */}
      <div className="border-b border-gray-200 px-4 py-3 dark:border-gray-700">
        <ImportFilters
          filters={filters}
          onChange={handleFiltersChange}
          stats={{
            totalCount: stats.totalCount,
            transferCount: stats.transferCount,
            microFeeCount: stats.microFeeCount,
            incomeCount: stats.incomeCount,
            expenseCount: stats.expenseCount,
          }}
          filteredCount={filteredTransactions.length}
        />
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto px-4 py-2">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-white dark:bg-gray-900">
            <tr className="border-b border-gray-200 dark:border-gray-700">
              <th className="w-8 py-2 text-left">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={() => (allSelected ? deselectAll() : selectAll())}
                  className="h-4 w-4 rounded border-gray-300"
                />
              </th>
              <th className="py-2 text-left text-gray-500 dark:text-gray-400">
                Fecha
              </th>
              <th className="py-2 text-left text-gray-500 dark:text-gray-400">
                Descripcion
              </th>
              <th className="py-2 text-right text-gray-500 dark:text-gray-400">
                Monto
              </th>
              <th className="py-2 text-left text-gray-500 dark:text-gray-400">
                Categoria
              </th>
              <th className="w-20 py-2 text-center text-gray-500 dark:text-gray-400">
                Tipo
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredTransactions.map((tx) => (
              <TransactionRow
                key={tx.id}
                transaction={tx}
                selected={selectedIds.has(tx.id)}
                onToggle={() => toggleSelection(tx.id)}
                categories={sortedCategories}
                onCategoryChange={(categoryId) =>
                  handleCategoryDropdownChange(tx.id, categoryId)
                }
              />
            ))}
          </tbody>
        </table>

        {filteredTransactions.length === 0 && (
          <div className="py-8 text-center text-gray-500">
            No hay transacciones que coincidan con los filtros.
          </div>
        )}
      </div>

      {/* Footer with summary and actions */}
      <div className="flex flex-col gap-2 border-t border-gray-200 px-4 py-3 dark:border-gray-700">
        {/* Total stats (all transactions) */}
        <div className="text-xs text-gray-500 dark:text-gray-500">
          Total en archivo: {totalStats.count} transacciones ·{' '}
          <span className="text-red-500">
            -{formatCurrency(totalStats.expenses)}
          </span>{' '}
          gastos ·{' '}
          <span className="text-green-500">
            +{formatCurrency(totalStats.income)}
          </span>{' '}
          ingresos
        </div>

        {/* Selected stats and actions */}
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            <span className="font-medium">{selectedStats.count}</span> de{' '}
            {totalStats.count} seleccionadas
            {' · '}
            <span className="text-red-600 dark:text-red-400">
              -{formatCurrency(selectedStats.expenses)}
            </span>
            {' gastos · '}
            <span className="text-green-600 dark:text-green-400">
              +{formatCurrency(selectedStats.income)}
            </span>
            {' ingresos'}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              onClick={() => onStage(selectedTransactions)}
              disabled={selectedStats.count === 0}
            >
              Continuar con {selectedStats.count} transacciones
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Sub-components
// ============================================================================

function TransactionRow({
  transaction,
  selected,
  onToggle,
  categories,
  onCategoryChange,
}: {
  transaction: EnrichedTransaction;
  selected: boolean;
  onToggle: () => void;
  categories: Category[];
  onCategoryChange: (categoryId: string) => void;
}) {
  const amountCents = Math.round(Math.abs(transaction.amount) * 100);

  return (
    <tr
      className={`border-b border-gray-100 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800/50 ${
        transaction.isTransfer ? 'opacity-60' : ''
      }`}
    >
      <td className="py-2">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggle}
          className="h-4 w-4 rounded border-gray-300"
        />
      </td>
      <td className="py-2 text-gray-600 dark:text-gray-400">
        {transaction.date || '-'}
      </td>
      <td className="max-w-xs truncate py-2 text-gray-900 dark:text-white">
        {transaction.description}
        {transaction.isTransfer && (
          <span className="ml-1 text-xs text-blue-500">(transferencia)</span>
        )}
      </td>
      <td
        className={`py-2 text-right font-medium ${
          transaction.isCredit
            ? 'text-green-600 dark:text-green-400'
            : 'text-red-600 dark:text-red-400'
        }`}
      >
        {transaction.isCredit ? '+' : '-'}
        {formatCurrency(amountCents)}
      </td>
      <td className="py-2">
        <select
          value={transaction.category.id ?? ''}
          onChange={(e) => onCategoryChange(e.target.value)}
          className={`w-full max-w-[180px] px-2 py-1 text-sm bg-transparent border rounded cursor-pointer focus:outline-none focus:ring-1 focus:ring-cyan-500 ${
            transaction.category.id
              ? 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300'
              : 'border-gray-300 dark:border-gray-600 text-gray-400 dark:text-gray-500'
          } ${transaction.category.confidence < 0.7 ? 'border-amber-400 dark:border-amber-500' : ''}`}
        >
          <option value="">Sin categoría</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.parentId
                ? `  ${cat.emoji || ''} ${cat.name}`
                : `${cat.emoji || ''} ${cat.name}`}
            </option>
          ))}
        </select>
        {transaction.category.confidence < 0.7 && transaction.category.id && (
          <span className="ml-1 text-xs text-amber-500" title="Baja confianza">
            ?
          </span>
        )}
      </td>
      <td className="py-2 text-center">
        <span
          className={`inline-block rounded px-2 py-0.5 text-xs ${
            transaction.isCredit
              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
              : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
          }`}
        >
          {transaction.isCredit ? 'Ingreso' : 'Gasto'}
        </span>
      </td>
    </tr>
  );
}
