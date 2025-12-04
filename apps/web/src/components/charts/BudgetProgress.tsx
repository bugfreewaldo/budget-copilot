'use client';

import type { Envelope, Category } from '@/lib/api';

interface BudgetProgressProps {
  envelopes: Envelope[];
  categories: Category[];
}

export function BudgetProgress({ envelopes, categories }: BudgetProgressProps) {
  if (envelopes.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-500">
        No hay presupuestos configurados
      </div>
    );
  }

  // Sort by percentage used (highest first)
  const sortedEnvelopes = [...envelopes].sort((a, b) => {
    const percentA = (a.spentCents / a.budgetCents) * 100;
    const percentB = (b.spentCents / b.budgetCents) * 100;
    return percentB - percentA;
  });

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
      {sortedEnvelopes.map((envelope) => {
        const category = categories.find((c) => c.id === envelope.categoryId);
        const percent = (envelope.spentCents / envelope.budgetCents) * 100;
        const isOverBudget = envelope.spentCents > envelope.budgetCents;
        const remaining = (envelope.budgetCents - envelope.spentCents) / 100;
        const spent = envelope.spentCents / 100;
        const budget = envelope.budgetCents / 100;

        // Envelope color based on status
        let envelopeColor = 'from-cyan-600 to-cyan-700';
        let statusColor = 'text-cyan-300';
        let statusBg = 'bg-cyan-500/20';

        if (percent >= 100) {
          envelopeColor = 'from-red-600 to-red-700';
          statusColor = 'text-red-300';
          statusBg = 'bg-red-500/20';
        } else if (percent >= 80) {
          envelopeColor = 'from-amber-600 to-amber-700';
          statusColor = 'text-amber-300';
          statusBg = 'bg-amber-500/20';
        } else if (percent >= 50) {
          envelopeColor = 'from-purple-600 to-purple-700';
          statusColor = 'text-purple-300';
          statusBg = 'bg-purple-500/20';
        }

        return (
          <div
            key={envelope.id}
            className="relative group cursor-pointer"
          >
            {/* Envelope Shape */}
            <div className={`relative bg-gradient-to-br ${envelopeColor} rounded-xl p-4 shadow-lg transition-transform hover:scale-105 hover:shadow-xl overflow-hidden`}>
              {/* Floating dollars on hover */}
              <div className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="absolute text-2xl animate-bounce" style={{ top: '10%', left: '10%', animationDelay: '0ms' }}>💵</span>
                <span className="absolute text-xl animate-bounce" style={{ top: '20%', right: '15%', animationDelay: '150ms' }}>💰</span>
                <span className="absolute text-lg animate-bounce" style={{ bottom: '30%', left: '20%', animationDelay: '300ms' }}>💲</span>
                <span className="absolute text-xl animate-bounce" style={{ bottom: '20%', right: '10%', animationDelay: '100ms' }}>💵</span>
              </div>

              {/* Envelope Flap (decorative triangle) */}
              <div className="absolute top-0 left-0 right-0 h-6 overflow-hidden">
                <div className={`absolute top-0 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[60px] border-r-[60px] border-t-[24px] border-l-transparent border-r-transparent border-t-gray-900/30`} />
              </div>

              {/* Content */}
              <div className="pt-4 text-center relative z-10">
                {/* Category Emoji */}
                <div className="text-3xl mb-2">{category?.emoji || '📦'}</div>

                {/* Category Name */}
                <p className="text-white font-medium text-sm truncate mb-3">
                  {category?.name || 'Sin categoría'}
                </p>

                {/* Amount Remaining */}
                <div className={`${statusBg} rounded-lg py-2 px-3 mb-2`}>
                  <p className={`text-xs ${statusColor}`}>
                    {isOverBudget ? 'Excedido' : 'Disponible'}
                  </p>
                  <p className={`text-lg font-bold ${isOverBudget ? 'text-red-300' : 'text-white'}`}>
                    ${Math.abs(remaining).toFixed(0)}
                  </p>
                </div>

                {/* Progress indicator */}
                <div className="flex items-center justify-center gap-1 text-xs text-white/70">
                  <span>${spent.toFixed(0)}</span>
                  <span>/</span>
                  <span>${budget.toFixed(0)}</span>
                </div>

                {/* Fill indicator bar */}
                <div className="mt-2 h-1.5 bg-black/20 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-white/40 rounded-full transition-all"
                    style={{ width: `${Math.min(percent, 100)}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
