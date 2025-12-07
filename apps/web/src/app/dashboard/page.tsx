'use client';

import { useState } from 'react';
import { Button } from '@budget-copilot/ui/button';
import Link from 'next/link';
import {
  getCurrentMonth,
  getFirstDayOfMonth,
  formatCents,
  deleteTransaction,
} from '@/lib/api';
import { useDashboardData } from '@/lib/hooks';

import { Sidebar } from '@/components/layout';
import { TransactionCopilot } from '@/components/copilot/TransactionCopilot';
import {
  SpendingByCategory,
  BudgetProgress,
  IncomeVsExpenses,
  FinancialWeather,
  CategoryDetailModal,
  SpenderPersonality,
} from '@/components/charts';
import { CreateTransactionModal } from '@/components/transactions';

// Get last day of current month
function getLastDayOfMonth(): string {
  const now = new Date();
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return lastDay.toISOString().split('T')[0]!;
}

/**
 * Dashboard page - protected (placeholder for auth)
 */
interface SelectedCategory {
  id: string;
  name: string;
  emoji: string;
  color: string;
}

export default function DashboardPage() {
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [transactionType, setTransactionType] = useState<'income' | 'expense'>(
    'expense'
  );
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] =
    useState<SelectedCategory | null>(null);

  const currentMonth = getCurrentMonth();
  const from = getFirstDayOfMonth();
  const to = getLastDayOfMonth();

  // Use SWR for cached data fetching - instant navigation!
  const {
    categories,
    transactions,
    envelopes,
    isLoading: loading,
    error: fetchError,
    refresh,
  } = useDashboardData(currentMonth, from, to);
  const error = fetchError
    ? 'Failed to load dashboard data. Is the API server running?'
    : null;

  const handleTransactionCreated = () => {
    // Refresh data when a new transaction is created via copilot
    refresh();
  };

  const openExpenseModal = () => {
    setTransactionType('expense');
    setShowTransactionModal(true);
  };

  const openIncomeModal = () => {
    setTransactionType('income');
    setShowTransactionModal(true);
  };

  const handleDeleteTransaction = async (id: string) => {
    if (deletingId) return;
    setDeletingId(id);
    try {
      await deleteTransaction(id);
      refresh();
    } catch (error) {
      console.error('Failed to delete transaction:', error);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <Sidebar>
      <div className="min-h-screen bg-gray-950">
        {/* Animated Background */}
        <div className="fixed inset-0 z-0 pointer-events-none">
          <div className="absolute top-0 -left-40 w-96 h-96 bg-purple-600 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-blob"></div>
          <div className="absolute top-0 -right-40 w-96 h-96 bg-cyan-600 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-blob animation-delay-2000"></div>
          <div className="absolute -bottom-40 left-40 w-96 h-96 bg-pink-600 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-blob animation-delay-4000"></div>
        </div>

        {/* Main Content */}
        <main className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 py-6 lg:py-8">
          {/* Page Header */}
          <div className="mb-6 lg:mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl lg:text-3xl font-bold text-white mb-1 lg:mb-2">
                Dashboard
              </h1>
              <p className="text-sm lg:text-base text-gray-400">
                ¡Bienvenido de vuelta! Aquí está tu resumen financiero.
              </p>
            </div>
            <div className="flex gap-2 lg:gap-3">
              <button
                onClick={openIncomeModal}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 lg:px-4 py-2 bg-green-500/20 hover:bg-green-500/30 text-green-400 border border-green-500/50 rounded-xl text-sm lg:text-base font-medium transition-all"
              >
                <span>↑</span> <span className="hidden sm:inline">Agregar</span>{' '}
                Ingreso
              </button>
              <button
                onClick={openExpenseModal}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 lg:px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/50 rounded-xl text-sm lg:text-base font-medium transition-all"
              >
                <span>↓</span> <span className="hidden sm:inline">Agregar</span>{' '}
                Gasto
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

          {/* Loading State */}
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-flex items-center gap-3 px-6 py-3 bg-gray-900/50 rounded-xl border border-gray-800">
                <div className="w-5 h-5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-gray-400">Cargando dashboard...</p>
              </div>
            </div>
          ) : (
            <>
              {/* Top Row: Weather + Personality */}
              <div className="grid md:grid-cols-3 gap-4 lg:gap-6 mb-6 lg:mb-8">
                {/* Financial Weather Widget */}
                <div className="md:col-span-2">
                  <h3 className="text-base lg:text-lg font-semibold text-white mb-3 lg:mb-4 flex items-center gap-2">
                    <span>🌤️</span> Tu Clima Financiero
                  </h3>
                  <FinancialWeather
                    transactions={transactions}
                    envelopes={envelopes}
                  />
                </div>

                {/* Spender Personality */}
                <div>
                  <div className="flex items-center justify-between mb-3 lg:mb-4">
                    <h3 className="text-base lg:text-lg font-semibold text-white flex items-center gap-2">
                      <span>🎭</span> Tu Perfil
                    </h3>
                    <Link
                      href="/perfil"
                      className="text-xs text-gray-400 hover:text-cyan-400 transition-colors flex items-center gap-1"
                    >
                      Ver cuenta <span>→</span>
                    </Link>
                  </div>
                  <SpenderPersonality
                    transactions={transactions}
                    categories={categories}
                  />
                </div>
              </div>

              {/* Charts Grid */}
              <div className="grid md:grid-cols-2 gap-4 lg:gap-6 mb-6 lg:mb-8">
                {/* Income vs Expenses */}
                <div className="bg-gray-900/50 backdrop-blur-xl rounded-2xl border border-gray-800 p-4 lg:p-6 hover:border-cyan-500/30 transition-all">
                  <h3 className="text-base lg:text-lg font-semibold text-white mb-3 lg:mb-4 flex items-center gap-2">
                    <span>💰</span> Ingresos vs Gastos
                  </h3>
                  <IncomeVsExpenses transactions={transactions} />
                </div>

                {/* Spending by Category */}
                <div className="bg-gray-900/50 backdrop-blur-xl rounded-2xl border border-gray-800 p-4 lg:p-6 hover:border-purple-500/30 transition-all">
                  <h3 className="text-base lg:text-lg font-semibold text-white mb-3 lg:mb-4 flex items-center gap-2">
                    <span>📊</span> Gastos por Categoría
                  </h3>
                  <SpendingByCategory
                    transactions={transactions}
                    categories={categories}
                    onCategoryClick={setSelectedCategory}
                  />
                </div>
              </div>

              {/* TODO: Temporarily hidden - re-enable when presupuesto is ready */}
              {/* Budget Progress Section */}
              {/* <div className="bg-gray-900/50 backdrop-blur-xl rounded-2xl border border-gray-800 p-4 lg:p-6 mb-6 lg:mb-8 hover:border-amber-500/30 transition-all">
                <h3 className="text-base lg:text-lg font-semibold text-white mb-3 lg:mb-4 flex items-center gap-2">
                  <span>📈</span> Progreso del Presupuesto - {currentMonth}
                </h3>
                <BudgetProgress envelopes={envelopes} categories={categories} />
              </div> */}

              {/* Recent Transactions Section */}
              <div className="bg-gray-900/50 backdrop-blur-xl rounded-2xl border border-gray-800 overflow-hidden mb-6 lg:mb-8">
                <div className="p-4 lg:p-6 border-b border-gray-800 flex items-center justify-between">
                  <h3 className="text-lg lg:text-xl font-semibold text-white flex items-center gap-2">
                    <span>💸</span> Transacciones Recientes
                  </h3>
                </div>
                {transactions.length === 0 ? (
                  <div className="p-6 lg:p-8 text-center">
                    <span className="text-5xl lg:text-6xl mb-4 lg:mb-6 block">
                      🤖
                    </span>
                    <h4 className="text-lg lg:text-xl font-semibold text-white mb-2 lg:mb-3">
                      ¡Comienza a registrar tus finanzas!
                    </h4>
                    <p className="text-gray-400 mb-4 max-w-md mx-auto text-sm lg:text-base">
                      Usa el asistente inteligente en la esquina inferior
                      derecha para agregar tus ingresos y gastos de forma
                      natural.
                    </p>
                    <p className="text-cyan-400 text-sm font-medium mb-2">
                      Prueba decir:
                    </p>
                    <div className="flex flex-wrap justify-center gap-2 text-xs lg:text-sm">
                      <span className="px-3 py-1 bg-gray-800 rounded-full text-gray-300">
                        "Recibí mi salario de $3,500"
                      </span>
                      <span className="px-3 py-1 bg-gray-800 rounded-full text-gray-300">
                        "Gasté $50 en Uber"
                      </span>
                      <span className="px-3 py-1 bg-gray-800 rounded-full text-gray-300">
                        "Pagué $120 de luz"
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 lg:p-6">
                    <div className="space-y-2 lg:space-y-3">
                      {transactions.slice(0, 5).map((tx) => {
                        const category = categories.find(
                          (c) => c.id === tx.categoryId
                        );
                        return (
                          <div
                            key={tx.id}
                            className="flex items-center justify-between p-3 bg-gray-800/50 border border-gray-700/50 rounded-xl"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div
                                className={`w-8 h-8 lg:w-10 lg:h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                                  tx.type === 'expense'
                                    ? 'bg-red-500/20 text-red-400'
                                    : 'bg-green-500/20 text-green-400'
                                }`}
                              >
                                {tx.type === 'expense' ? '↓' : '↑'}
                              </div>
                              <div className="min-w-0">
                                <div className="font-medium text-white text-sm lg:text-base truncate">
                                  {tx.description}
                                </div>
                                <div className="text-xs lg:text-sm text-gray-500 truncate">
                                  {category?.name || 'Sin categoría'} •{' '}
                                  {tx.date}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 lg:gap-3 flex-shrink-0 ml-2">
                              <div
                                className={`font-semibold text-sm lg:text-base ${
                                  tx.type === 'expense'
                                    ? 'text-red-400'
                                    : 'text-green-400'
                                }`}
                              >
                                {formatCents(tx.amountCents)}
                              </div>
                              <button
                                onClick={() => handleDeleteTransaction(tx.id)}
                                disabled={deletingId === tx.id}
                                className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all disabled:opacity-50"
                                title="Eliminar transacción"
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
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Categories Section */}
              <div className="bg-gray-900/50 backdrop-blur-xl rounded-2xl border border-gray-800 overflow-hidden">
                <div className="p-4 lg:p-6 border-b border-gray-800 flex items-center justify-between">
                  <h3 className="text-lg lg:text-xl font-semibold text-white flex items-center gap-2">
                    <span>🏷️</span> Tus Categorías
                  </h3>
                  <Link href="/categories">
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-gray-700 text-gray-300 hover:bg-gray-800 hover:border-cyan-500/50 text-xs lg:text-sm"
                    >
                      Manejar
                    </Button>
                  </Link>
                </div>
                {categories.length === 0 ? (
                  <div className="p-6 lg:p-8 text-center">
                    <span className="text-3xl lg:text-4xl mb-3 lg:mb-4 block">
                      📭
                    </span>
                    <p className="text-gray-400 mb-4 text-sm lg:text-base">
                      No hay categorías aún. ¡Crea algunas para empezar!
                    </p>
                    <Link href="/categories">
                      <Button className="bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-600 hover:to-purple-600 border-0 text-sm lg:text-base">
                        ➕ Crear Categorías
                      </Button>
                    </Link>
                  </div>
                ) : (
                  <div className="p-4 lg:p-6">
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 lg:gap-4">
                      {categories.slice(0, 9).map((category) => (
                        <div
                          key={category.id}
                          className="p-3 lg:p-4 bg-gray-800/50 border border-gray-700/50 rounded-xl hover:bg-gray-800 hover:border-cyan-500/30 transition-all cursor-pointer group"
                        >
                          <div className="flex items-center gap-2">
                            {category.emoji && (
                              <span className="text-lg lg:text-xl">
                                {category.emoji}
                              </span>
                            )}
                            <span className="font-medium text-white group-hover:text-cyan-400 transition-colors text-sm lg:text-base truncate">
                              {category.name}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                    {categories.length > 9 && (
                      <div className="mt-4 lg:mt-6 text-center">
                        <Link href="/categories">
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-gray-700 text-gray-300 hover:bg-gray-800 text-xs lg:text-sm"
                          >
                            Ver Todas las {categories.length} Categorías →
                          </Button>
                        </Link>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </main>

        {/* Transaction Copilot */}
        <TransactionCopilot onTransactionCreated={handleTransactionCreated} />

        {/* Manual Transaction Modal */}
        <CreateTransactionModal
          isOpen={showTransactionModal}
          onClose={() => setShowTransactionModal(false)}
          onSuccess={handleTransactionCreated}
          defaultType={transactionType}
        />

        {/* Category Detail Modal */}
        <CategoryDetailModal
          isOpen={selectedCategory !== null}
          onClose={() => setSelectedCategory(null)}
          category={selectedCategory}
          transactions={transactions}
        />
      </div>
    </Sidebar>
  );
}
