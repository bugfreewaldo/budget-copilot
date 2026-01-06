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
  return date.toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function TransaccionesPage(): React.ReactElement {
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
    ? 'Error al cargar las transacciones. ¿Está el servidor corriendo?'
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

  const getCategoryName = (categoryId: string | null): string => {
    if (!categoryId) return 'Sin categoría';
    const category = categories.find((c) => c.id === categoryId);
    return category ? category.name : 'Sin categoría';
  };

  const getCategoryEmoji = (categoryId: string | null): string => {
    if (!categoryId) return '';
    const category = categories.find((c) => c.id === categoryId);
    return category?.emoji || '';
  };

  // Calculate totals
  const totals = useMemo(() => {
    const income = filteredTransactions
      .filter((tx) => tx.type === 'income')
      .reduce((sum, tx) => sum + Math.abs(tx.amountCents), 0);
    const expense = filteredTransactions
      .filter((tx) => tx.type === 'expense')
      .reduce((sum, tx) => sum + Math.abs(tx.amountCents), 0);
    return { income, expense, balance: income - expense };
  }, [filteredTransactions]);

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
                Transacciones
              </h1>
              <p className="text-sm lg:text-base text-gray-400">
                Gestiona y busca todas tus transacciones
              </p>
            </div>
            <div className="flex gap-2 lg:gap-3">
              <button
                onClick={openIncomeModal}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 lg:px-4 py-2 bg-green-500/20 hover:bg-green-500/30 text-green-400 border border-green-500/50 rounded-xl text-sm lg:text-base font-medium transition-all"
              >
                <span>↑</span> Ingreso
              </button>
              <button
                onClick={openExpenseModal}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 lg:px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/50 rounded-xl text-sm lg:text-base font-medium transition-all"
              >
                <span>↓</span> Gasto
              </button>
            </div>
          </div>

          {/* Error State */}
          {error && (
            <div className="mb-6 lg:mb-8 p-4 bg-red-900/30 border border-red-500/50 rounded-lg backdrop-blur-sm">
              <p className="text-red-400 font-medium">Error</p>
              <p className="text-red-300 text-sm">{error}</p>
            </div>
          )}

          {/* Summary Cards */}
          <div className="grid grid-cols-3 gap-3 lg:gap-4 mb-6">
            <div className="bg-gray-900/50 backdrop-blur-xl rounded-xl border border-gray-800 p-3 lg:p-4">
              <p className="text-xs lg:text-sm text-gray-400 mb-1">Ingresos</p>
              <p className="text-lg lg:text-xl font-bold text-green-400">
                {formatCents(totals.income)}
              </p>
            </div>
            <div className="bg-gray-900/50 backdrop-blur-xl rounded-xl border border-gray-800 p-3 lg:p-4">
              <p className="text-xs lg:text-sm text-gray-400 mb-1">Gastos</p>
              <p className="text-lg lg:text-xl font-bold text-red-400">
                {formatCents(totals.expense)}
              </p>
            </div>
            <div className="bg-gray-900/50 backdrop-blur-xl rounded-xl border border-gray-800 p-3 lg:p-4">
              <p className="text-xs lg:text-sm text-gray-400 mb-1">Balance</p>
              <p
                className={`text-lg lg:text-xl font-bold ${totals.balance >= 0 ? 'text-cyan-400' : 'text-red-400'}`}
              >
                {formatCents(totals.balance)}
              </p>
            </div>
          </div>

          {/* Search and Filters */}
          <div className="bg-gray-900/50 backdrop-blur-xl rounded-xl border border-gray-800 p-4 mb-6 space-y-4">
            {/* Date Range Filter */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm text-gray-400">Período:</span>
                <div className="flex flex-wrap gap-2">
                  {[
                    { key: 'this-month', label: 'Este mes' },
                    { key: 'last-month', label: 'Mes pasado' },
                    { key: 'last-3-months', label: 'Últimos 3 meses' },
                    { key: 'this-year', label: 'Este año' },
                    { key: 'all-time', label: 'Todo' },
                    { key: 'custom', label: 'Personalizado' },
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
                    <span className="text-sm text-gray-400">Desde:</span>
                    <input
                      type="date"
                      value={customFromDate}
                      onChange={(e) => setCustomFromDate(e.target.value)}
                      className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-400">Hasta:</span>
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
                  Mostrando: {formatDateForDisplay(from)} -{' '}
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
                  placeholder="Buscar transacciones..."
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
                <option value="all">Todos</option>
                <option value="income">Ingresos</option>
                <option value="expense">Gastos</option>
              </select>

              {/* Category Filter */}
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
              >
                <option value="all">Todas las categorías</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.emoji} {cat.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Transactions List */}
          <div className="bg-gray-900/50 backdrop-blur-xl rounded-2xl border border-gray-800 overflow-hidden">
            <div className="p-4 lg:p-6 border-b border-gray-800 flex items-center justify-between">
              <h3 className="text-lg lg:text-xl font-semibold text-white flex items-center gap-2">
                <span>💸</span> Lista de Transacciones
              </h3>
              <span className="text-sm text-gray-500">
                {filteredTransactions.length} de {transactions.length}
              </span>
            </div>

            {loading ? (
              <div className="p-8 text-center">
                <div className="inline-flex items-center gap-3 px-6 py-3 bg-gray-900/50 rounded-xl border border-gray-800">
                  <div className="w-5 h-5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
                  <p className="text-gray-400">Cargando transacciones...</p>
                </div>
              </div>
            ) : filteredTransactions.length === 0 ? (
              <div className="p-8 text-center">
                <span className="text-4xl mb-4 block">🔍</span>
                <p className="text-gray-400">
                  {searchQuery ||
                  typeFilter !== 'all' ||
                  categoryFilter !== 'all'
                    ? 'No se encontraron transacciones con los filtros aplicados'
                    : 'No hay transacciones aún'}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-800">
                {filteredTransactions.map((tx) => (
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
                      <div className="font-medium text-white truncate">
                        {tx.description}
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
                        title="Editar"
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
                        title="Eliminar"
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
          title="Eliminar Transacción"
          message={`¿Estás seguro de eliminar "${deleteConfirm?.description}"? Esta acción no se puede deshacer.`}
          confirmText="Eliminar"
          cancelText="Cancelar"
          variant="danger"
          isLoading={deletingId !== null}
        />
      </div>
    </Sidebar>
  );
}
