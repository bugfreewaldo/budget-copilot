'use client';

import { useMemo, useState, useEffect } from 'react';
import Link from 'next/link';
import { Sidebar } from '@/components/layout';
import { IncomeVsExpenses } from '@/components/charts/IncomeVsExpenses';
import { SpendingByCategory } from '@/components/charts/SpendingByCategory';
import { useDashboardData } from '@/lib/hooks';
import { getCurrentMonth, formatCents } from '@/lib/api';

function getMonthDateRange(): { from: string; to: string } {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  return {
    from: firstDay.toISOString().split('T')[0]!,
    to: lastDay.toISOString().split('T')[0]!,
  };
}

export default function DashboardPage(): React.ReactElement {
  const currentMonth = getCurrentMonth();
  const { from, to } = getMonthDateRange();
  const { categories, transactions, isLoading, error } = useDashboardData(
    currentMonth,
    from,
    to
  );

  const [cumulativeBalance, setCumulativeBalance] = useState<number | null>(
    null
  );

  useEffect(() => {
    fetch('/api/v1/balance', { credentials: 'include' })
      .then((res) => res.json())
      .then((json) => {
        if (json.data?.currentBalanceCents !== undefined) {
          setCumulativeBalance(json.data.currentBalanceCents);
        }
      })
      .catch(() => {});
  }, [transactions]);

  const totals = useMemo(() => {
    const income = transactions
      .filter((tx) => tx.type === 'income')
      .reduce((sum, tx) => sum + Math.abs(tx.amountCents), 0);
    const expenses = transactions
      .filter((tx) => tx.type === 'expense')
      .reduce((sum, tx) => sum + Math.abs(tx.amountCents), 0);
    const balance = income - expenses;
    return { income, expenses, balance };
  }, [transactions, cumulativeBalance]);

  const monthLabel = new Date().toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  return (
    <Sidebar>
      <div className="min-h-screen bg-gray-950">
        {/* Background */}
        <div className="fixed inset-0 z-0 pointer-events-none">
          <div className="absolute top-0 -left-40 w-96 h-96 bg-purple-600 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-blob"></div>
          <div className="absolute top-0 -right-40 w-96 h-96 bg-cyan-600 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-blob animation-delay-2000"></div>
        </div>

        <main className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 py-6 lg:py-8">
          {/* Header */}
          <div className="mb-6 lg:mb-8">
            <h1 className="text-2xl lg:text-3xl font-bold text-white mb-1">
              Dashboard
            </h1>
            <p className="text-sm lg:text-base text-gray-400">{monthLabel}</p>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-3 gap-3 lg:gap-4 mb-6">
            <div className="bg-gray-900/50 backdrop-blur-xl rounded-xl border border-gray-800 p-3 lg:p-4">
              <p className="text-xs lg:text-sm text-gray-400 mb-1">Income</p>
              <p className="text-lg lg:text-2xl font-bold text-green-400">
                {isLoading ? '...' : formatCents(totals.income)}
              </p>
            </div>
            <div className="bg-gray-900/50 backdrop-blur-xl rounded-xl border border-gray-800 p-3 lg:p-4">
              <p className="text-xs lg:text-sm text-gray-400 mb-1">Expenses</p>
              <p className="text-lg lg:text-2xl font-bold text-red-400">
                {isLoading ? '...' : formatCents(totals.expenses)}
              </p>
            </div>
            <div className="bg-gray-900/50 backdrop-blur-xl rounded-xl border border-gray-800 p-3 lg:p-4">
              <p className="text-xs lg:text-sm text-gray-400 mb-1">Balance</p>
              <p
                className={`text-lg lg:text-2xl font-bold ${totals.balance >= 0 ? 'text-cyan-400' : 'text-red-400'}`}
              >
                {isLoading ? '...' : formatCents(totals.balance)}
              </p>
            </div>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-900/30 border border-red-500/50 rounded-lg">
              <p className="text-red-400 text-sm">
                Failed to load data. Is the server running?
              </p>
            </div>
          )}

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <IncomeVsExpenses transactions={transactions} />
            <SpendingByCategory
              transactions={transactions}
              categories={categories}
            />
          </div>
        </main>

        {/* Floating Advisor Button */}
        <Link href="/advisor" className="fixed bottom-6 right-6 z-50 group">
          <div className="flex items-center gap-3 bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 text-white rounded-full px-5 py-3 shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 transition-all">
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
              />
            </svg>
            <span className="font-medium text-sm">Talk to Advisor</span>
          </div>
        </Link>
      </div>
    </Sidebar>
  );
}
