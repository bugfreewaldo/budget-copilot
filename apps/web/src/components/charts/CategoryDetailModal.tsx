'use client';

import { useMemo } from 'react';
import type { Transaction } from '@/lib/api';

interface CategoryDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  category: {
    id: string;
    name: string;
    emoji: string;
    color: string;
  } | null;
  transactions: Transaction[];
}

export function CategoryDetailModal({
  isOpen,
  onClose,
  category,
  transactions,
}: CategoryDetailModalProps) {
  // Filter transactions for this category
  const categoryTransactions = useMemo(() => {
    if (!category) return [];
    return transactions
      .filter((tx) => {
        const txCategoryId = tx.categoryId || 'uncategorized';
        return txCategoryId === category.id && tx.type === 'expense';
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [category, transactions]);

  // Calculate insights
  const insights = useMemo(() => {
    if (categoryTransactions.length === 0) return null;

    const total = categoryTransactions.reduce(
      (sum, tx) => sum + Math.abs(tx.amountCents),
      0
    );
    const average = total / categoryTransactions.length;
    const largest = categoryTransactions.reduce(
      (max, tx) =>
        Math.abs(tx.amountCents) > Math.abs(max.amountCents) ? tx : max,
      categoryTransactions[0]!
    );

    // Day of week analysis
    const dayCount: Record<number, number> = {};
    categoryTransactions.forEach((tx) => {
      const day = new Date(tx.date).getDay();
      dayCount[day] = (dayCount[day] || 0) + 1;
    });
    const mostFrequentDay = Object.entries(dayCount).sort(
      ([, a], [, b]) => b - a
    )[0];
    const dayNames = [
      'Sunday',
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
    ];

    // Monthly trend (compare first half vs second half of transactions)
    const midpoint = Math.floor(categoryTransactions.length / 2);
    const recentTotal = categoryTransactions
      .slice(0, midpoint)
      .reduce((sum, tx) => sum + Math.abs(tx.amountCents), 0);
    const olderTotal = categoryTransactions
      .slice(midpoint)
      .reduce((sum, tx) => sum + Math.abs(tx.amountCents), 0);
    const trendDirection =
      midpoint > 0 && olderTotal > 0
        ? ((recentTotal - olderTotal) / olderTotal) * 100
        : 0;

    return {
      total: total / 100,
      average: average / 100,
      count: categoryTransactions.length,
      largest: {
        description: largest.description,
        amount: Math.abs(largest.amountCents) / 100,
        date: largest.date,
      },
      mostFrequentDay: mostFrequentDay
        ? dayNames[parseInt(mostFrequentDay[0])]
        : null,
      trendDirection,
    };
  }, [categoryTransactions]);

  // Generate suggestions based on category and insights
  const suggestions = useMemo(() => {
    if (!category || !insights) return [];
    const tips: string[] = [];
    const categoryName = category.name.toLowerCase();

    // Subscription-specific tips
    if (
      categoryName.includes('suscripcion') ||
      categoryName.includes('suscripciones') ||
      categoryName.includes('streaming')
    ) {
      tips.push(
        '💡 Check if you use all your services. Canceling one could save you $10-15/mo.'
      );
      if (insights.count > 3) {
        tips.push('🔄 Consider bundling services into family plans to save.');
      }
    }

    // Food/restaurant tips
    if (
      categoryName.includes('comida') ||
      categoryName.includes('restaurante') ||
      categoryName.includes('delivery')
    ) {
      if (insights.average > 15) {
        tips.push(
          '🍳 Cooking at home 2 more times per week could save you ~$' +
            Math.round(insights.average * 2) +
            '/week.'
        );
      }
      if (insights.mostFrequentDay) {
        tips.push(
          `📅 You spend more on ${insights.mostFrequentDay}s. Plan meals for that day.`
        );
      }
    }

    // Transport tips
    if (
      categoryName.includes('transporte') ||
      categoryName.includes('uber') ||
      categoryName.includes('taxi') ||
      categoryName.includes('gasolina')
    ) {
      if (insights.total > 100) {
        tips.push(
          '🚌 Using public transit 2 times per week could save you ~$40/mo.'
        );
      }
    }

    // Entertainment tips
    if (
      categoryName.includes('entretenimiento') ||
      categoryName.includes('ocio')
    ) {
      tips.push(
        '🎬 Look for discount days (movie Tuesdays, happy hours) to save.'
      );
    }

    // Shopping tips
    if (
      categoryName.includes('compras') ||
      categoryName.includes('shopping') ||
      categoryName.includes('ropa')
    ) {
      tips.push('🛍️ Wait 48 hours before impulse purchases over $50.');
    }

    // Generic tips based on data
    if (insights.trendDirection > 20) {
      tips.push(
        `📈 Your spending in this category has increased ~${Math.round(insights.trendDirection)}% recently.`
      );
    } else if (insights.trendDirection < -20) {
      tips.push(
        `📉 Nice! You've reduced your spending in this category by ~${Math.round(Math.abs(insights.trendDirection))}%.`
      );
    }

    if (insights.largest.amount > insights.average * 3) {
      tips.push(
        `⚠️ You had a large expense of $${insights.largest.amount.toFixed(0)} on "${insights.largest.description}". Was it necessary?`
      );
    }

    // Default tip if none matched
    if (tips.length === 0) {
      tips.push(
        `📊 Your average per transaction is $${insights.average.toFixed(2)}. Can you reduce it by 10%?`
      );
    }

    return tips.slice(0, 3); // Max 3 tips
  }, [category, insights]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen || !category) return null;

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-40"
      onClick={onClose}
      onKeyDown={handleKeyDown}
    >
      <div
        className="bg-gray-900 rounded-2xl border border-gray-800 shadow-2xl max-w-lg w-full mx-4 max-h-[85vh] flex flex-col animate-fade-in"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="category-detail-title"
      >
        {/* Header */}
        <div
          className="p-6 border-b border-gray-800 flex items-center justify-between"
          style={{ borderLeftColor: category.color }}
        >
          <div className="flex items-center gap-3">
            <span className="text-3xl">{category.emoji}</span>
            <div>
              <h2
                id="category-detail-title"
                className="text-xl font-semibold text-white"
              >
                {category.name}
              </h2>
              {insights && (
                <p className="text-sm text-gray-400">
                  {insights.count} transactions this month
                </p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
            aria-label="Close"
          >
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
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Insights Summary */}
          {insights && (
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700/50">
                <p className="text-xs text-gray-400 mb-1">Total Spent</p>
                <p className="text-xl font-bold text-white">
                  $
                  {insights.total.toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                  })}
                </p>
              </div>
              <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700/50">
                <p className="text-xs text-gray-400 mb-1">Average</p>
                <p className="text-xl font-bold text-cyan-400">
                  $
                  {insights.average.toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                  })}
                </p>
              </div>
              {insights.largest && (
                <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700/50 col-span-2">
                  <p className="text-xs text-gray-400 mb-1">Largest expense</p>
                  <div className="flex justify-between items-center">
                    <p className="text-sm text-gray-300 truncate flex-1">
                      {insights.largest.description}
                    </p>
                    <p className="text-lg font-bold text-purple-400 ml-2">
                      $
                      {insights.largest.amount.toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                      })}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Suggestions */}
          {suggestions.length > 0 && (
            <div className="bg-gradient-to-br from-cyan-900/20 to-purple-900/20 rounded-xl p-4 border border-cyan-500/20">
              <h3 className="text-sm font-semibold text-cyan-400 mb-3 flex items-center gap-2">
                <span>🧠</span> Copilot Suggestions
              </h3>
              <ul className="space-y-2">
                {suggestions.map((tip, i) => (
                  <li key={i} className="text-sm text-gray-300">
                    {tip}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Transactions List */}
          <div>
            <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
              <span>📋</span> Transactions
            </h3>
            {categoryTransactions.length === 0 ? (
              <p className="text-gray-500 text-center py-4">
                No transactions in this category
              </p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {categoryTransactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg border border-gray-700/50 hover:border-gray-600 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate">
                        {tx.sensitive
                          ? '🔒 Hidden transaction'
                          : tx.description}
                      </p>
                      <p className="text-xs text-gray-500">
                        {new Date(tx.date).toLocaleDateString('en-US', {
                          weekday: 'short',
                          day: 'numeric',
                          month: 'short',
                        })}
                      </p>
                    </div>
                    <p className="text-sm font-medium text-red-400 ml-3">
                      -$
                      {(Math.abs(tx.amountCents) / 100).toLocaleString(
                        'en-US',
                        { minimumFractionDigits: 2 }
                      )}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-800">
          <button
            onClick={onClose}
            className="w-full py-2 px-4 text-sm font-medium text-gray-300 bg-gray-800 border border-gray-700 rounded-xl hover:bg-gray-700 transition-all"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
