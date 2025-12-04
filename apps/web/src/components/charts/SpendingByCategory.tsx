'use client';

import type { Category, Transaction } from '@/lib/api';

interface SpendingByCategoryProps {
  transactions: Transaction[];
  categories: Category[];
}

const COLORS = [
  '#06b6d4', // cyan
  '#8b5cf6', // purple
  '#f43f5e', // rose
  '#22c55e', // green
  '#f59e0b', // amber
  '#3b82f6', // blue
  '#ec4899', // pink
  '#14b8a6', // teal
];

export function SpendingByCategory({
  transactions,
  categories,
}: SpendingByCategoryProps) {
  // Calculate spending by category (only expenses)
  const spendingByCategory = transactions
    .filter((tx) => tx.type === 'expense')
    .reduce<Record<string, number>>((acc, tx) => {
      const categoryId = tx.categoryId || 'uncategorized';
      acc[categoryId] = (acc[categoryId] || 0) + Math.abs(tx.amountCents);
      return acc;
    }, {});

  // Build chart data
  const data = Object.entries(spendingByCategory)
    .map(([categoryId, amountCents]) => {
      const category = categories.find((c) => c.id === categoryId);
      return {
        name: category?.name || 'Sin categoría',
        value: amountCents / 100,
        emoji: category?.emoji || '📦',
      };
    })
    .sort((a, b) => b.value - a.value)
    .slice(0, 6); // Top 6 categories

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-gray-500">
        No hay gastos este mes
      </div>
    );
  }

  const total = data.reduce((sum, item) => sum + item.value, 0);
  const maxValue = data[0]?.value || 1;

  return (
    <div className="space-y-3">
      {data.map((item, index) => {
        const percent = (item.value / maxValue) * 100;
        return (
          <div key={item.name} className="flex items-center gap-3">
            <span className="text-xl w-8 text-center">{item.emoji}</span>
            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm text-gray-300 truncate">
                  {item.name}
                </span>
                <span className="text-sm font-medium text-white ml-2">
                  $
                  {item.value.toLocaleString('en-US', {
                    minimumFractionDigits: 0,
                  })}
                </span>
              </div>
              <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${percent}%`,
                    backgroundColor: COLORS[index % COLORS.length],
                  }}
                />
              </div>
            </div>
          </div>
        );
      })}
      <div className="pt-3 mt-2 border-t border-gray-700 flex items-center justify-between">
        <span className="text-gray-400">Total Gastado</span>
        <span className="text-xl font-bold text-white">
          ${total.toLocaleString('en-US', { minimumFractionDigits: 2 })}
        </span>
      </div>
    </div>
  );
}
