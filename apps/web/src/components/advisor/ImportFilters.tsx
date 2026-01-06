'use client';

import { useState, useCallback } from 'react';
import { Button } from '@budget-copilot/ui/button';

export interface ImportFiltersState {
  excludeTransfers: boolean;
  excludeMicroFees: boolean;
  typeFilter: 'all' | 'income' | 'expense';
}

interface ImportFiltersProps {
  filters: ImportFiltersState;
  onChange: (filters: ImportFiltersState) => void;
  stats: {
    totalCount: number;
    transferCount: number;
    microFeeCount: number;
    incomeCount: number;
    expenseCount: number;
  };
  filteredCount: number;
}

/**
 * ImportFilters - Filter controls for import preview
 *
 * Shows toggles for:
 * - Exclude transfers between accounts
 * - Exclude micro-fees (< $1)
 * - Type filter (all/income/expense)
 */
export function ImportFilters({
  filters,
  onChange,
  stats,
  filteredCount,
}: ImportFiltersProps) {
  const updateFilter = useCallback(
    <K extends keyof ImportFiltersState>(
      key: K,
      value: ImportFiltersState[K]
    ) => {
      onChange({ ...filters, [key]: value });
    },
    [filters, onChange]
  );

  // Check if any filter is active
  const hasActiveFilters =
    filters.excludeTransfers ||
    filters.excludeMicroFees ||
    filters.typeFilter !== 'all';

  // Reset all filters
  const resetFilters = useCallback(() => {
    onChange({
      excludeTransfers: false,
      excludeMicroFees: false,
      typeFilter: 'all',
    });
  }, [onChange]);

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800/50">
      <div className="flex flex-wrap items-center gap-4">
        {/* Show all button */}
        {hasActiveFilters && (
          <Button
            variant="outline"
            size="sm"
            onClick={resetFilters}
            className="h-7 px-2 text-xs"
          >
            Mostrar todo ({stats.totalCount})
          </Button>
        )}

        {/* Transfer filter */}
        {stats.transferCount > 0 && (
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={filters.excludeTransfers}
              onChange={(e) =>
                updateFilter('excludeTransfers', e.target.checked)
              }
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-gray-700 dark:text-gray-300">
              Excluir transferencias ({stats.transferCount})
            </span>
          </label>
        )}

        {/* Micro-fees filter */}
        {stats.microFeeCount > 0 && (
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={filters.excludeMicroFees}
              onChange={(e) =>
                updateFilter('excludeMicroFees', e.target.checked)
              }
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-gray-700 dark:text-gray-300">
              Excluir micro-cargos &lt;$1 ({stats.microFeeCount})
            </span>
          </label>
        )}

        {/* Type filter */}
        <div className="flex items-center gap-1 rounded-md bg-gray-200 p-0.5 dark:bg-gray-700">
          <Button
            variant={filters.typeFilter === 'all' ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => updateFilter('typeFilter', 'all')}
            className="h-7 px-2 text-xs"
          >
            Todos ({stats.totalCount})
          </Button>
          <Button
            variant={filters.typeFilter === 'expense' ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => updateFilter('typeFilter', 'expense')}
            className="h-7 px-2 text-xs"
          >
            Gastos ({stats.expenseCount})
          </Button>
          <Button
            variant={filters.typeFilter === 'income' ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => updateFilter('typeFilter', 'income')}
            className="h-7 px-2 text-xs"
          >
            Ingresos ({stats.incomeCount})
          </Button>
        </div>
      </div>

      {/* Filtered count summary */}
      <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
        Mostrando {filteredCount} de {stats.totalCount} transacciones
        {hasActiveFilters && ' (filtros activos)'}
      </div>
    </div>
  );
}

/**
 * Default filter state
 */
export const DEFAULT_IMPORT_FILTERS: ImportFiltersState = {
  excludeTransfers: true,
  excludeMicroFees: true,
  typeFilter: 'all',
};

/**
 * Hook for managing import filters
 */
export function useImportFilters(
  initialState: ImportFiltersState = DEFAULT_IMPORT_FILTERS
) {
  const [filters, setFilters] = useState<ImportFiltersState>(initialState);
  return { filters, setFilters };
}
