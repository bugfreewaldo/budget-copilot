/**
 * SWR hooks for data fetching with caching
 * Provides instant navigation by caching API responses
 */

import useSWR from 'swr';
import type {
  Category,
  Transaction,
  Envelope,
  Page,
  Debt,
  DebtStatus,
  DebtSummary,
  DebtStrategies,
  Goal,
  GoalStatus,
  GoalType,
  GoalSummary,
  UploadedFile,
  FileSummaryResponse,
} from './api';

const API_BASE_URL = '/api';

// Generic fetcher for SWR
const fetcher = async <T>(url: string): Promise<T> => {
  const res = await fetch(`${API_BASE_URL}${url}`, {
    credentials: 'include',
  });

  if (!res.ok) {
    const error = new Error('API request failed');
    throw error;
  }

  return res.json();
};

// SWR configuration for optimal caching
const swrConfig = {
  revalidateOnFocus: false, // Don't refetch when window regains focus
  revalidateIfStale: true, // Revalidate in background if data is stale
  dedupingInterval: 5000, // Dedupe requests within 5 seconds
};

/**
 * Hook for fetching categories with caching
 */
export function useCategories(options?: { limit?: number; q?: string }) {
  const params = new URLSearchParams();
  if (options?.limit) params.set('limit', String(options.limit));
  if (options?.q) params.set('q', options.q);

  const queryString = params.toString();
  const key = `/v1/categories${queryString ? `?${queryString}` : ''}`;

  const { data, error, isLoading, mutate } = useSWR<Page<Category>>(
    key,
    fetcher,
    swrConfig
  );

  return {
    categories: data?.data ?? [],
    nextCursor: data?.nextCursor ?? null,
    isLoading,
    error,
    refresh: mutate,
  };
}

/**
 * Hook for fetching transactions with caching
 */
export function useTransactions(options?: { from?: string; to?: string }) {
  const params = new URLSearchParams();
  if (options?.from) params.set('from', options.from);
  if (options?.to) params.set('to', options.to);

  const queryString = params.toString();
  const key = `/v1/transactions${queryString ? `?${queryString}` : ''}`;

  const { data, error, isLoading, mutate } = useSWR<{ data: Transaction[] }>(
    key,
    fetcher,
    swrConfig
  );

  return {
    transactions: data?.data ?? [],
    isLoading,
    error,
    refresh: mutate,
  };
}

/**
 * Hook for fetching envelopes with caching
 */
export function useEnvelopes(month: string) {
  const key = `/v1/envelopes?month=${month}`;

  const { data, error, isLoading, mutate } = useSWR<{ data: Envelope[] }>(
    key,
    fetcher,
    swrConfig
  );

  return {
    envelopes: data?.data ?? [],
    isLoading,
    error,
    refresh: mutate,
  };
}

/**
 * Refresh all dashboard data
 */
export function useDashboardData(month: string, from: string, to: string) {
  const categories = useCategories({ limit: 500 });
  const transactions = useTransactions({ from, to });
  const envelopes = useEnvelopes(month);

  const isLoading =
    categories.isLoading || transactions.isLoading || envelopes.isLoading;
  const error = categories.error || transactions.error || envelopes.error;

  const refresh = () => {
    categories.refresh();
    transactions.refresh();
    envelopes.refresh();
  };

  return {
    categories: categories.categories,
    transactions: transactions.transactions,
    envelopes: envelopes.envelopes,
    isLoading,
    error,
    refresh,
  };
}

/**
 * Hook for fetching debts with caching
 */
export function useDebts(options?: { status?: DebtStatus }) {
  const params = new URLSearchParams();
  if (options?.status) params.set('status', options.status);

  const queryString = params.toString();
  const key = `/v1/debts${queryString ? `?${queryString}` : ''}`;

  const { data, error, isLoading, mutate } = useSWR<
    Page<Debt> & { summary: DebtSummary }
  >(key, fetcher, swrConfig);

  return {
    debts: data?.data ?? [],
    summary: data?.summary ?? null,
    nextCursor: data?.nextCursor ?? null,
    isLoading,
    error,
    refresh: mutate,
  };
}

/**
 * Hook for fetching debt strategies
 */
export function useDebtStrategies() {
  const { data, error, isLoading, mutate } = useSWR<{ data: DebtStrategies }>(
    '/v1/debts/strategies',
    fetcher,
    swrConfig
  );

  return {
    strategies: data?.data ?? null,
    isLoading,
    error,
    refresh: mutate,
  };
}

/**
 * Hook for fetching goals with caching
 */
export function useGoals(options?: { status?: GoalStatus; type?: GoalType }) {
  const params = new URLSearchParams();
  if (options?.status) params.set('status', options.status);
  if (options?.type) params.set('type', options.type);

  const queryString = params.toString();
  const key = `/v1/goals${queryString ? `?${queryString}` : ''}`;

  const { data, error, isLoading, mutate } = useSWR<
    Page<Goal> & { summary: GoalSummary }
  >(key, fetcher, swrConfig);

  return {
    goals: data?.data ?? [],
    summary: data?.summary ?? null,
    nextCursor: data?.nextCursor ?? null,
    isLoading,
    error,
    refresh: mutate,
  };
}

/**
 * Hook for fetching uploaded files
 */
export function useFiles() {
  const { data, error, isLoading, mutate } = useSWR<{ data: UploadedFile[] }>(
    '/v1/files',
    fetcher,
    swrConfig
  );

  return {
    files: data?.data ?? [],
    isLoading,
    error,
    refresh: mutate,
  };
}

/**
 * Hook for fetching a file's parsed summary
 * Returns null if file is not yet processed
 */
export function useFileSummary(fileId: string | null) {
  const { data, error, isLoading, mutate } = useSWR<FileSummaryResponse>(
    fileId ? `/v1/files/${fileId}/summary` : null,
    fetcher,
    {
      ...swrConfig,
      // Poll every 3 seconds while processing
      refreshInterval: (latestData) => {
        // If we got data, stop polling
        if (latestData) return 0;
        // If still processing (404), poll every 3s
        return 3000;
      },
      // Don't throw on 404 (file still processing)
      shouldRetryOnError: false,
    }
  );

  return {
    summary: data ?? null,
    isLoading,
    isProcessing: !data && !error,
    error,
    refresh: mutate,
  };
}
