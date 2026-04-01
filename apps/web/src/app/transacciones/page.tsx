'use client';

import { useState, useMemo } from 'react';
import { Sidebar } from '@/components/layout';
import { TransactionCopilot } from '@/components/copilot/TransactionCopilot';
import { CreateTransactionModal } from '@/components/transactions';
import { useDashboardData } from '@/lib/hooks';
import {
  getCurrentMonth,
  formatCents,
  deleteTransaction,
  type Transaction,
} from '@/lib/api';
import { ConfirmModal } from '@/components/ui/ConfirmModal';

// Date range presets
type DatePreset =
  | 'this-month'
  | 'last-month'
  | 'this-year'
  | 'last-3-months'
  | 'all-time'
  | 'custom';

function getDatePresetRange(preset: DatePreset): { from: string; to: string } {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  switch (preset) {
    case 'this-month': {
      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);
      return {
        from: firstDay.toISOString().split('T')[0]!,
        to: lastDay.toISOString().split('T')[0]!,
      };
    }
    case 'last-month': {
      const firstDay = new Date(year, month - 1, 1);
      const lastDay = new Date(year, month, 0);
      return {
        from: firstDay.toISOString().split('T')[0]!,
        to: lastDay.toISOString().split('T')[0]!,
      };
    }
    case 'last-3-months': {
      const firstDay = new Date(year, month - 2, 1);
      const lastDay = new Date(year, month + 1, 0);
      return {
        from: firstDay.toISOString().split('T')[0]!,
        to: lastDay.toISOString().split('T')[0]!,
      };
    }
    case 'this-year': {
      return {
        from: `${year}-01-01`,
        to: `${year}-12-31`,
      };
    }
    case 'all-time':
    default:
      return {
        from: '2020-01-01',
        to: '2099-12-31',
      };
  }
}

function formatDateForDisplay(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function TransactionsPage(): React.ReactElement {
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'income' | 'expense'>(
    'all'
  );
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [transactionType, setTransactionType] = useState<'income' | 'expense'>(
    'expense'
  );
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Transaction | null>(null);
  const [editingTransaction, setEditingTransaction] =
    useState<Transaction | null>(null);
  const [autoCategorizing, setAutoCategorizing] = useState(false);
  const [autoCatResult, setAutoCatResult] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 50;

  // Balance adjustment state
  const [showBalanceModal, setShowBalanceModal] = useState(false);
  const [balanceAmount, setBalanceAmount] = useState('');
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [balanceInfo, setBalanceInfo] = useState<{
    currentBalanceCents: number;
    canAdjust: boolean;
    nextAdjustmentAt: number | null;
    lastAdjustment: { date: string; amountCents: number } | null;
  } | null>(null);
  // Date range state - default to current month
  const [datePreset, setDatePreset] = useState<DatePreset>('this-month');
  const [customFromDate, setCustomFromDate] = useState<string>('');
  const [customToDate, setCustomToDate] = useState<string>('');

  // Calculate actual date range based on preset or custom
  const dateRange = useMemo(() => {
    if (datePreset === 'custom' && customFromDate && customToDate) {
      return { from: customFromDate, to: customToDate };
    }
    return getDatePresetRange(datePreset);
  }, [datePreset, customFromDate, customToDate]);

  const currentMonth = getCurrentMonth();
  const { from, to } = dateRange;

  const {
    categories,
    transactions,
    isLoading: loading,
    error: fetchError,
    refresh,
  } = useDashboardData(currentMonth, from, to);
  const error = fetchError
    ? 'Failed to load transactions. Is the server running?'
    : null;

  // Filter transactions based on search and filters
  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      // Search query filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        if (!tx.description.toLowerCase().includes(query)) {
          return false;
        }
      }

      // Type filter
      if (typeFilter !== 'all' && tx.type !== typeFilter) {
        return false;
      }

      // Category filter
      if (categoryFilter !== 'all' && tx.categoryId !== categoryFilter) {
        return false;
      }

      return true;
    });
  }, [transactions, searchQuery, typeFilter, categoryFilter]);

  const handleDeleteTransaction = async () => {
    if (!deleteConfirm || deletingId) return;

    setDeletingId(deleteConfirm.id);
    try {
      await deleteTransaction(deleteConfirm.id);
      setDeleteConfirm(null);
      refresh();
    } catch (error) {
      console.error('Failed to delete transaction:', error);
    } finally {
      setDeletingId(null);
    }
  };

  const handleTransactionCreated = () => {
    refresh();
    setShowTransactionModal(false);
    setEditingTransaction(null);
  };

  const openExpenseModal = () => {
    setTransactionType('expense');
    setEditingTransaction(null);
    setShowTransactionModal(true);
  };

  const openIncomeModal = () => {
    setTransactionType('income');
    setEditingTransaction(null);
    setShowTransactionModal(true);
  };

  const openEditModal = (transaction: Transaction) => {
    setEditingTransaction(transaction);
    setTransactionType(transaction.type);
    setShowTransactionModal(true);
  };

  const handleAutoCategorize = async () => {
    setAutoCategorizing(true);
    setAutoCatResult(null);
    try {
      const res = await fetch('/api/v1/transactions/auto-categorize', {
        method: 'POST',
        credentials: 'include',
      });
      const json = await res.json();
      if (res.ok) {
        setAutoCatResult(json.data.message);
        refresh();
      } else {
        setAutoCatResult('Failed to auto-categorize. Try again.');
      }
    } catch {
      setAutoCatResult('Failed to auto-categorize. Try again.');
    } finally {
      setAutoCategorizing(false);
    }
  };

  const uncategorizedCount = transactions.filter((tx) => !tx.categoryId).length;

  const openBalanceModal = async () => {
    setShowBalanceModal(true);
    setBalanceAmount('');
    try {
      const res = await fetch('/api/v1/balance', { credentials: 'include' });
      const json = await res.json();
      if (res.ok) {
        setBalanceInfo(json.data);
        setBalanceAmount((json.data.currentBalanceCents / 100).toFixed(2));
      }
    } catch {
      /* ignore */
    }
  };

  const handleSetBalance = async () => {
    const cents = Math.round(parseFloat(balanceAmount) * 100);
    if (isNaN(cents)) return;

    setBalanceLoading(true);
    try {
      const res = await fetch('/api/v1/balance', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actualBalanceCents: cents }),
      });
      const json = await res.json();
      if (res.ok) {
        setShowBalanceModal(false);
        setAutoCatResult(json.data.message);
        refresh();
      } else {
        setAutoCatResult(json.error?.message || 'Failed to adjust balance');
      }
    } catch {
      setAutoCatResult('Failed to adjust balance');
    } finally {
      setBalanceLoading(false);
    }
  };

  const getCategoryName = (categoryId: string | null): string => {
    if (!categoryId) return 'Uncategorized';
    const category = categories.find((c) => c.id === categoryId);
    return category ? category.name : 'Uncategorized';
  };

  const getCategoryEmoji = (categoryId: string | null): string => {
    if (!categoryId) return '';
    const category = categories.find((c) => c.id === categoryId);
    return category?.emoji || '';
  };

  // Income/Expense from filtered transactions, Balance is cumulative (all-time)
  const totals = useMemo(() => {
    const income = filteredTransactions
      .filter((tx) => tx.type === 'income')
      .reduce((sum, tx) => sum + Math.abs(tx.amountCents), 0);
    const expense = filteredTransactions
      .filter((tx) => tx.type === 'expense')
      .reduce((sum, tx) => sum + Math.abs(tx.amountCents), 0);
    const balance = income - expense;
    return { income, expense, balance };
  }, [filteredTransactions]);

  // Pagination
  const totalPages = Math.max(
    1,
    Math.ceil(filteredTransactions.length / PAGE_SIZE)
  );
  const paginatedTransactions = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredTransactions.slice(start, start + PAGE_SIZE);
  }, [filteredTransactions, currentPage]);

  // Reset page when filters change
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useMemo(() => {
    setCurrentPage(1);
  }, [searchQuery, typeFilter, categoryFilter, from, to]);

  return (
    <Sidebar>
      <div className="min-h-screen bg-gray-950">
        {/* Animated Background */}
        <div className="fixed inset-0 z-0 pointer-events-none">
          <div className="absolute top-0 -left-40 w-96 h-96 bg-purple-600 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-blob"></div>
          <div className="absolute top-0 -right-40 w-96 h-96 bg-cyan-600 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-blob animation-delay-2000"></div>
        </div>

        {/* Main Content */}
        <main className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 py-6 lg:py-8">
          {/* Page Header */}
          <div className="mb-6 lg:mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl lg:text-3xl font-bold text-white mb-1 lg:mb-2">
                Transactions
              </h1>
              <p className="text-sm lg:text-base text-gray-400">
                Manage and search all your transactions
              </p>
            </div>
            <div className="flex gap-2 lg:gap-3">
              {uncategorizedCount > 0 && (
                <button
                  onClick={handleAutoCategorize}
                  disabled={autoCategorizing}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 lg:px-4 py-2 bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 border border-purple-500/50 rounded-xl text-sm lg:text-base font-medium transition-all disabled:opacity-50"
                >
                  {autoCategorizing ? (
                    <>
                      <div className="w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin"></div>
                      Categorizing...
                    </>
                  ) : (
                    <>
                      <span>✦</span> Auto-categorize ({uncategorizedCount})
                    </>
                  )}
                </button>
              )}
              <button
                onClick={openIncomeModal}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 lg:px-4 py-2 bg-green-500/20 hover:bg-green-500/30 text-green-400 border border-green-500/50 rounded-xl text-sm lg:text-base font-medium transition-all"
              >
                <span>↑</span> Income
              </button>
              <button
                onClick={openExpenseModal}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 lg:px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/50 rounded-xl text-sm lg:text-base font-medium transition-all"
              >
                <span>↓</span> Expense
              </button>
            </div>
          </div>

          {/* Auto-categorize Result */}
          {autoCatResult && (
            <div className="mb-4 p-3 bg-purple-900/30 border border-purple-500/50 rounded-lg backdrop-blur-sm flex items-center justify-between">
              <p className="text-purple-300 text-sm flex items-center gap-2">
                <span>✦</span> {autoCatResult}
              </p>
              <button
                onClick={() => setAutoCatResult(null)}
                className="text-purple-400 hover:text-purple-300 text-sm"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="mb-6 lg:mb-8 p-4 bg-red-900/30 border border-red-500/50 rounded-lg backdrop-blur-sm">
              <p className="text-red-400 font-medium">Error</p>
              <p className="text-red-300 text-sm">{error}</p>
            </div>
          )}

          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 lg:gap-4 mb-6">
            <div className="bg-gray-900/50 backdrop-blur-xl rounded-xl border border-gray-800 p-3 lg:p-4">
              <p className="text-xs lg:text-sm text-gray-400 mb-1">Income</p>
              <p className="text-lg lg:text-xl font-bold text-green-400">
                {formatCents(totals.income)}
              </p>
            </div>
            <div className="bg-gray-900/50 backdrop-blur-xl rounded-xl border border-gray-800 p-3 lg:p-4">
              <p className="text-xs lg:text-sm text-gray-400 mb-1">Expenses</p>
              <p className="text-lg lg:text-xl font-bold text-red-400">
                {formatCents(totals.expense)}
              </p>
            </div>
            <button
              onClick={openBalanceModal}
              className="bg-gray-900/50 backdrop-blur-xl rounded-xl border border-gray-800 p-3 lg:p-4 text-left hover:border-cyan-500/50 transition-all group"
            >
              <p className="text-xs lg:text-sm text-gray-400 mb-1 flex items-center gap-1">
                Balance
                <span className="text-gray-600 group-hover:text-cyan-400 transition-colors text-xs">
                  (adjust)
                </span>
              </p>
              <p
                className={`text-lg lg:text-xl font-bold ${totals.balance >= 0 ? 'text-cyan-400' : 'text-red-400'}`}
              >
                {formatCents(totals.balance)}
              </p>
            </button>
          </div>

          {/* Search and Filters */}
          <div className="bg-gray-900/50 backdrop-blur-xl rounded-xl border border-gray-800 p-4 mb-6 space-y-4">
            {/* Date Range Filter */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm text-gray-400">Period:</span>
                <div className="flex flex-wrap gap-2">
                  {[
                    { key: 'this-month', label: 'This month' },
                    { key: 'last-month', label: 'Last month' },
                    { key: 'last-3-months', label: 'Last 3 months' },
                    { key: 'this-year', label: 'This year' },
                    { key: 'all-time', label: 'All' },
                    { key: 'custom', label: 'Custom' },
                  ].map(({ key, label }) => (
                    <button
                      key={key}
                      onClick={() => setDatePreset(key as DatePreset)}
                      className={`px-3 py-1.5 text-sm rounded-lg transition-all ${
                        datePreset === key
                          ? 'bg-cyan-600 text-white'
                          : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Date Range */}
              {datePreset === 'custom' && (
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-400">From:</span>
                    <input
                      type="date"
                      value={customFromDate}
                      onChange={(e) => setCustomFromDate(e.target.value)}
                      className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-400">To:</span>
                    <input
                      type="date"
                      value={customToDate}
                      onChange={(e) => setCustomToDate(e.target.value)}
                      className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                </div>
              )}

              {/* Show current date range */}
              {datePreset !== 'all-time' && (
                <p className="text-xs text-gray-500">
                  Showing: {formatDateForDisplay(from)} -{' '}
                  {formatDateForDisplay(to)}
                </p>
              )}
            </div>

            {/* Divider */}
            <div className="border-t border-gray-800" />

            {/* Search and other filters */}
            <div className="flex flex-col sm:flex-row gap-3">
              {/* Search Input */}
              <div className="flex-1 relative">
                <svg
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
                <input
                  type="text"
                  placeholder="Search transactions..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500"
                />
              </div>

              {/* Type Filter */}
              <select
                value={typeFilter}
                onChange={(e) =>
                  setTypeFilter(e.target.value as 'all' | 'income' | 'expense')
                }
                className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
              >
                <option value="all">All</option>
                <option value="income">Income</option>
                <option value="expense">Expenses</option>
              </select>

              {/* Category Filter */}
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
              >
                <option value="all">All categories</option>
                {(() => {
                  const parents = categories
                    .filter((c) => !c.parentId)
                    .sort((a, b) => a.name.localeCompare(b.name));
                  return parents.map((parent) => {
                    const children = categories
                      .filter((c) => c.parentId === parent.id)
                      .sort((a, b) => a.name.localeCompare(b.name));
                    if (children.length > 0) {
                      return (
                        <optgroup
                          key={parent.id}
                          label={`${parent.emoji || ''} ${parent.name}`}
                        >
                          <option value={parent.id}>
                            {parent.emoji || ''} {parent.name} (all)
                          </option>
                          {children.map((child) => (
                            <option key={child.id} value={child.id}>
                              {child.emoji || ''} {child.name}
                            </option>
                          ))}
                        </optgroup>
                      );
                    }
                    return (
                      <option key={parent.id} value={parent.id}>
                        {parent.emoji || ''} {parent.name}
                      </option>
                    );
                  });
                })()}
              </select>
            </div>
          </div>

          {/* Transactions List */}
          <div className="bg-gray-900/50 backdrop-blur-xl rounded-2xl border border-gray-800 overflow-hidden">
            <div className="p-4 lg:p-6 border-b border-gray-800 flex items-center justify-between">
              <h3 className="text-lg lg:text-xl font-semibold text-white flex items-center gap-2">
                <span>💸</span> Transaction List
              </h3>
              <span className="text-sm text-gray-500">
                {filteredTransactions.length} of {transactions.length}
                {totalPages > 1 && ` · Page ${currentPage} of ${totalPages}`}
              </span>
            </div>

            {loading ? (
              <div className="p-8 text-center">
                <div className="inline-flex items-center gap-3 px-6 py-3 bg-gray-900/50 rounded-xl border border-gray-800">
                  <div className="w-5 h-5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
                  <p className="text-gray-400">Loading transactions...</p>
                </div>
              </div>
            ) : paginatedTransactions.length === 0 ? (
              <div className="p-8 text-center">
                <span className="text-4xl mb-4 block">🔍</span>
                <p className="text-gray-400">
                  {searchQuery ||
                  typeFilter !== 'all' ||
                  categoryFilter !== 'all'
                    ? 'No transactions found with the applied filters'
                    : 'No transactions yet'}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-800">
                {paginatedTransactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="p-4 hover:bg-gray-800/30 transition-colors flex items-center gap-4"
                  >
                    {/* Icon */}
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                        tx.type === 'expense'
                          ? 'bg-red-500/20 text-red-400'
                          : 'bg-green-500/20 text-green-400'
                      }`}
                    >
                      {tx.type === 'expense' ? '↓' : '↑'}
                    </div>

                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-white truncate flex items-center gap-2">
                        {tx.sensitive ? (
                          <>
                            <span className="italic text-gray-500">
                              Hidden transaction
                            </span>
                            <span
                              className="text-purple-400 text-xs"
                              title="Sensitive — description hidden"
                            >
                              🔒
                            </span>
                          </>
                        ) : (
                          tx.description
                        )}
                      </div>
                      <div className="text-sm text-gray-500 flex items-center gap-2 flex-wrap">
                        <span>{tx.date}</span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          {getCategoryEmoji(tx.categoryId)}{' '}
                          {getCategoryName(tx.categoryId)}
                        </span>
                      </div>
                    </div>

                    {/* Amount */}
                    <div
                      className={`font-semibold flex-shrink-0 ${
                        tx.type === 'expense'
                          ? 'text-red-400'
                          : 'text-green-400'
                      }`}
                    >
                      {formatCents(tx.amountCents)}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => openEditModal(tx)}
                        className="p-2 flex items-center justify-center text-gray-500 hover:text-cyan-400 hover:bg-cyan-500/10 rounded-lg transition-all"
                        title="Edit"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                          />
                        </svg>
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(tx)}
                        disabled={deletingId === tx.id}
                        className="p-2 flex items-center justify-center text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all disabled:opacity-50"
                        title="Delete"
                      >
                        {deletingId === tx.id ? (
                          <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="p-4 border-t border-gray-800 flex items-center justify-between">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-4 py-2 text-sm font-medium text-gray-300 bg-gray-800 border border-gray-700 rounded-lg hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  Previous
                </button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter(
                      (p) =>
                        p === 1 ||
                        p === totalPages ||
                        Math.abs(p - currentPage) <= 2
                    )
                    .reduce<(number | 'ellipsis')[]>((acc, p, i, arr) => {
                      if (
                        i > 0 &&
                        arr[i - 1] !== undefined &&
                        p - (arr[i - 1] as number) > 1
                      ) {
                        acc.push('ellipsis');
                      }
                      acc.push(p);
                      return acc;
                    }, [])
                    .map((item, i) =>
                      item === 'ellipsis' ? (
                        <span key={`e${i}`} className="px-2 text-gray-600">
                          ...
                        </span>
                      ) : (
                        <button
                          key={item}
                          onClick={() => setCurrentPage(item)}
                          className={`w-9 h-9 text-sm rounded-lg transition-all ${
                            currentPage === item
                              ? 'bg-cyan-600 text-white font-medium'
                              : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                          }`}
                        >
                          {item}
                        </button>
                      )
                    )}
                </div>
                <button
                  onClick={() =>
                    setCurrentPage((p) => Math.min(totalPages, p + 1))
                  }
                  disabled={currentPage === totalPages}
                  className="px-4 py-2 text-sm font-medium text-gray-300 bg-gray-800 border border-gray-700 rounded-lg hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </main>

        {/* Transaction Copilot */}
        <TransactionCopilot onTransactionCreated={handleTransactionCreated} />

        {/* Manual Transaction Modal */}
        <CreateTransactionModal
          isOpen={showTransactionModal}
          onClose={() => {
            setShowTransactionModal(false);
            setEditingTransaction(null);
          }}
          onSuccess={handleTransactionCreated}
          defaultType={transactionType}
          editingTransaction={editingTransaction}
        />

        {/* Delete Confirmation Modal */}
        <ConfirmModal
          isOpen={deleteConfirm !== null}
          onClose={() => setDeleteConfirm(null)}
          onConfirm={handleDeleteTransaction}
          title="Delete Transaction"
          message={`Are you sure you want to delete "${deleteConfirm?.sensitive ? 'Hidden transaction' : deleteConfirm?.description}"? This action cannot be undone.`}
          confirmText="Delete"
          cancelText="Cancel"
          variant="danger"
          isLoading={deletingId !== null}
        />

        {/* Balance Adjustment Modal */}
        {showBalanceModal && (
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-40"
            onClick={() => !balanceLoading && setShowBalanceModal(false)}
          >
            <div
              className="bg-gray-900 rounded-2xl border border-gray-800 shadow-2xl max-w-md w-full mx-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6">
                <h2 className="text-xl font-semibold text-white mb-1">
                  Set Actual Balance
                </h2>
                <p className="text-sm text-gray-400 mb-5">
                  If your balance doesn{"'"}t match reality, enter the correct
                  amount. We{"'"}ll create an adjustment transaction to
                  reconcile.
                </p>

                {/* Warning */}
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 mb-5">
                  <p className="text-amber-400 text-xs">
                    This feature is meant for initial setup or genuine
                    corrections only. Adjustments are limited to once per week.
                    Frequent adjustments indicate missing transactions —
                    consider importing your bank statement instead.
                  </p>
                </div>

                {/* Current balance info */}
                {balanceInfo && (
                  <div className="text-sm text-gray-400 mb-4 space-y-1">
                    <p>
                      Current calculated balance:{' '}
                      <span className="text-white font-medium">
                        {formatCents(balanceInfo.currentBalanceCents)}
                      </span>
                    </p>
                    {balanceInfo.lastAdjustment && (
                      <p className="text-xs text-gray-500">
                        Last adjusted on {balanceInfo.lastAdjustment.date}
                      </p>
                    )}
                  </div>
                )}

                {/* Input */}
                <div className="mb-5">
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    What is your actual balance right now?
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                      $
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      value={balanceAmount}
                      onChange={(e) => setBalanceAmount(e.target.value)}
                      disabled={
                        balanceLoading ||
                        (balanceInfo !== null && !balanceInfo.canAdjust)
                      }
                      className="w-full pl-8 pr-3 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white text-lg placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 disabled:opacity-50 transition-all"
                      placeholder="0.00"
                      autoFocus
                    />
                  </div>
                </div>

                {/* Cooldown message */}
                {balanceInfo &&
                  !balanceInfo.canAdjust &&
                  balanceInfo.nextAdjustmentAt && (
                    <div className="bg-gray-800 rounded-lg p-3 mb-5">
                      <p className="text-gray-400 text-sm">
                        Next adjustment available on{' '}
                        <span className="text-white">
                          {new Date(
                            balanceInfo.nextAdjustmentAt
                          ).toLocaleDateString()}
                        </span>
                      </p>
                    </div>
                  )}

                {/* Buttons */}
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowBalanceModal(false)}
                    disabled={balanceLoading}
                    className="flex-1 py-2.5 text-sm font-medium text-gray-300 bg-gray-800 border border-gray-700 rounded-xl hover:bg-gray-700 disabled:opacity-50 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSetBalance}
                    disabled={
                      balanceLoading ||
                      !balanceAmount.trim() ||
                      (balanceInfo !== null && !balanceInfo.canAdjust)
                    }
                    className="flex-1 py-2.5 text-sm font-medium text-white bg-cyan-600 hover:bg-cyan-700 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    {balanceLoading ? 'Adjusting...' : 'Set Balance'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Sidebar>
  );
}
