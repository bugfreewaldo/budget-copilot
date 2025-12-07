'use client';

import type { Transaction } from '@/lib/api';

interface IncomeVsExpensesProps {
  transactions: Transaction[];
}

export function IncomeVsExpenses({ transactions }: IncomeVsExpensesProps) {
  const income =
    transactions
      .filter((tx) => tx.type === 'income')
      .reduce((sum, tx) => sum + tx.amountCents, 0) / 100;

  const expenses =
    transactions
      .filter((tx) => tx.type === 'expense')
      .reduce((sum, tx) => sum + Math.abs(tx.amountCents), 0) / 100;

  const balance = income - expenses;
  const savingsRate = income > 0 ? ((balance / income) * 100).toFixed(0) : 0;
  const isLowBalance = balance >= 0 && balance < 100;

  if (income === 0 && expenses === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-gray-500">
        No hay transacciones este mes
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Main Balance Display */}
      <div className="text-center py-4">
        <p className="text-gray-400 text-sm mb-1">Balance del Mes</p>
        <p
          className={`text-4xl font-bold ${balance < 0 ? 'text-red-400' : isLowBalance ? 'text-amber-400' : 'text-green-400'}`}
        >
          {balance >= 0 ? '+' : ''}$
          {Math.abs(balance).toLocaleString('en-US', {
            minimumFractionDigits: 2,
          })}
        </p>
        {balance > 0 && !isLowBalance && (
          <p className="text-cyan-400 text-sm mt-1">
            Ahorrando {savingsRate}% de tus ingresos
          </p>
        )}
        {isLowBalance && (
          <div className="mt-2 px-3 py-2 bg-amber-500/20 border border-amber-500/40 rounded-lg inline-block">
            <p className="text-amber-400 text-sm font-medium flex items-center gap-1">
              <span>&#9888;</span> Balance bajo - Cuidado con los gastos
            </p>
          </div>
        )}
      </div>

      {/* Income and Expenses Summary */}
      <div className="grid grid-cols-2 gap-3">
        <div className="p-4 bg-green-500/10 rounded-xl border border-green-500/20">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-green-400">↑</span>
            <span className="text-gray-400 text-sm">Ingresos</span>
          </div>
          <p className="text-xl font-bold text-green-400">
            ${income.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="p-4 bg-red-500/10 rounded-xl border border-red-500/20">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-red-400">↓</span>
            <span className="text-gray-400 text-sm">Gastos</span>
          </div>
          <p className="text-xl font-bold text-red-400">
            ${expenses.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </p>
        </div>
      </div>
    </div>
  );
}
