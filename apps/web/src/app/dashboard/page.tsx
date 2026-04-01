'use client';

import { useMemo, useState, useEffect } from 'react';
import Link from 'next/link';
import { Sidebar } from '@/components/layout';
import { IncomeVsExpenses } from '@/components/charts/IncomeVsExpenses';
import { SpendingByCategory } from '@/components/charts/SpendingByCategory';
import { CategoryDetailModal } from '@/components/charts/CategoryDetailModal';
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

  const [selectedCategory, setSelectedCategory] = useState<{
    id: string;
    name: string;
    emoji: string;
    color: string;
  } | null>(null);

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

  // Email report state
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailTo, setEmailTo] = useState('');
  const [emailSending, setEmailSending] = useState(false);
  const [emailResult, setEmailResult] = useState<string | null>(null);
  const [emailIncludeTransactions, setEmailIncludeTransactions] =
    useState(false);
  const [emailPreviewHtml, setEmailPreviewHtml] = useState<string | null>(null);
  const [emailLoadingPreview, setEmailLoadingPreview] = useState(false);

  const handlePreviewReport = async () => {
    setEmailLoadingPreview(true);
    try {
      const res = await fetch('/api/v1/reports/email', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          preview: true,
          includeTransactions: emailIncludeTransactions,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setEmailPreviewHtml(data.data.html);
      }
    } catch {
      /* ignore */
    } finally {
      setEmailLoadingPreview(false);
    }
  };

  const handleSendReport = async () => {
    if (!emailTo.trim()) return;
    setEmailSending(true);
    setEmailResult(null);
    try {
      const res = await fetch('/api/v1/reports/email', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: emailTo.trim(),
          includeTransactions: emailIncludeTransactions,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setEmailResult(`Sent to ${emailTo}`);
        setTimeout(() => {
          setShowEmailModal(false);
          setEmailResult(null);
          setEmailTo('');
          setEmailPreviewHtml(null);
        }, 2000);
      } else {
        setEmailResult(data.error?.message || 'Failed to send');
      }
    } catch {
      setEmailResult('Failed to send');
    } finally {
      setEmailSending(false);
    }
  };

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
          <div className="mb-6 lg:mb-8 flex items-center justify-between">
            <div>
              <h1 className="text-2xl lg:text-3xl font-bold text-white mb-1">
                Dashboard
              </h1>
              <p className="text-sm lg:text-base text-gray-400">{monthLabel}</p>
            </div>
            <button
              onClick={() => setShowEmailModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700 rounded-xl text-sm font-medium transition-all"
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
                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
              Email Report
            </button>
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
              onCategoryClick={setSelectedCategory}
            />
          </div>
        </main>

        {/* Email Report Modal */}
        {showEmailModal && (
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-40"
            onClick={() => !emailSending && setShowEmailModal(false)}
          >
            <div
              className={`bg-gray-900 rounded-2xl border border-gray-800 shadow-2xl mx-4 flex flex-col ${emailPreviewHtml ? 'max-w-4xl w-full max-h-[90vh]' : 'max-w-md w-full'}`}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 flex-shrink-0">
                <h2 className="text-xl font-semibold text-white mb-1">
                  Email Financial Report
                </h2>
                <p className="text-sm text-gray-400 mb-5">
                  Send a summary of your balance, income, expenses, and debts to
                  any email.
                </p>

                {/* Options */}
                <label className="flex items-center gap-3 cursor-pointer mb-4">
                  <input
                    type="checkbox"
                    checked={emailIncludeTransactions}
                    onChange={(e) => {
                      setEmailIncludeTransactions(e.target.checked);
                      setEmailPreviewHtml(null);
                    }}
                    className="w-4 h-4 rounded border-gray-600"
                  />
                  <span className="text-sm text-gray-300">
                    Include all transactions this month
                  </span>
                </label>

                {/* Email input */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Send to
                  </label>
                  <input
                    type="email"
                    value={emailTo}
                    onChange={(e) => setEmailTo(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSendReport()}
                    disabled={emailSending}
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 disabled:opacity-50 transition-all"
                    placeholder="email@example.com"
                    autoFocus
                  />
                </div>

                {emailResult && (
                  <div
                    className={`mb-4 p-3 rounded-lg text-sm ${
                      emailResult.startsWith('Sent')
                        ? 'bg-green-900/30 border border-green-500/50 text-green-400'
                        : 'bg-red-900/30 border border-red-500/50 text-red-400'
                    }`}
                  >
                    {emailResult}
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setShowEmailModal(false);
                      setEmailResult(null);
                      setEmailPreviewHtml(null);
                    }}
                    disabled={emailSending}
                    className="py-2.5 px-4 text-sm font-medium text-gray-300 bg-gray-800 border border-gray-700 rounded-xl hover:bg-gray-700 disabled:opacity-50 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handlePreviewReport}
                    disabled={emailLoadingPreview || emailSending}
                    className="py-2.5 px-4 text-sm font-medium text-gray-300 bg-gray-800 border border-gray-700 rounded-xl hover:bg-gray-700 disabled:opacity-50 transition-all flex items-center gap-2"
                  >
                    {emailLoadingPreview ? (
                      <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
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
                          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                        />
                      </svg>
                    )}
                    Preview
                  </button>
                  <button
                    onClick={handleSendReport}
                    disabled={emailSending || !emailTo.trim()}
                    className="flex-1 py-2.5 text-sm font-medium text-white bg-cyan-600 hover:bg-cyan-700 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                  >
                    {emailSending ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        Sending...
                      </>
                    ) : (
                      'Send Report'
                    )}
                  </button>
                </div>
              </div>

              {/* Preview Pane */}
              {emailPreviewHtml && (
                <div className="border-t border-gray-800 flex-1 overflow-auto">
                  <div className="p-3 bg-gray-800/50 flex items-center justify-between flex-shrink-0">
                    <span className="text-xs text-gray-400">Email Preview</span>
                    <button
                      onClick={() => setEmailPreviewHtml(null)}
                      className="text-xs text-gray-500 hover:text-gray-300"
                    >
                      Close preview
                    </button>
                  </div>
                  <iframe
                    srcDoc={emailPreviewHtml}
                    className="w-full h-[500px] bg-white rounded-b-2xl"
                    title="Email preview"
                    sandbox=""
                  />
                </div>
              )}
            </div>
          </div>
        )}

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

      <CategoryDetailModal
        isOpen={!!selectedCategory}
        category={selectedCategory}
        transactions={transactions}
        onClose={() => setSelectedCategory(null)}
      />
    </Sidebar>
  );
}
