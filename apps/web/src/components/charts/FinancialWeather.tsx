'use client';

import type { Transaction, Envelope } from '@/lib/api';

interface FinancialWeatherProps {
  transactions: Transaction[];
  envelopes: Envelope[];
}

interface WeatherState {
  emoji: string;
  status: string;
  message: string;
  color: string;
  bgColor: string;
}

/**
 * Calculate financial "weather" based on spending patterns and budget usage
 */
function calculateWeather(
  transactions: Transaction[],
  envelopes: Envelope[]
): WeatherState {
  // Calculate total income and expenses this period
  const income = transactions
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + t.amountCents, 0);

  const expenses = transactions
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + Math.abs(t.amountCents), 0);

  // Calculate budget usage
  const totalBudget = envelopes.reduce((sum, e) => sum + e.budgetCents, 0);
  const totalSpent = envelopes.reduce((sum, e) => sum + e.spentCents, 0);

  // Calculate net position
  const netPosition = income - expenses;

  // Days calculation
  const daysInMonth = new Date(
    new Date().getFullYear(),
    new Date().getMonth() + 1,
    0
  ).getDate();
  const currentDay = new Date().getDate();
  const daysRemaining = daysInMonth - currentDay + 1;

  // If no budgets are set up, calculate based on income/expenses
  const hasBudgets = totalBudget > 0;

  let budgetUsagePercent: number;
  let safeToSpendDaily: number;

  if (hasBudgets) {
    // Use budget-based calculation
    budgetUsagePercent = (totalSpent / totalBudget) * 100;
    const remainingBudget = totalBudget - totalSpent;
    safeToSpendDaily =
      remainingBudget > 0 ? Math.floor(remainingBudget / daysRemaining / 100) : 0;
  } else {
    // Use income-based calculation when no budgets exist
    // Calculate spending rate as percentage of income
    budgetUsagePercent =
      income > 0 ? (expenses / income) * 100 : expenses > 0 ? 100 : 0;
    // Safe to spend = remaining income divided by remaining days
    const remainingIncome = Math.max(0, netPosition);
    safeToSpendDaily = Math.floor(remainingIncome / daysRemaining / 100);
  }

  // Determine weather based on multiple factors
  if (budgetUsagePercent >= 100 || netPosition < 0) {
    return {
      emoji: '⛈️',
      status: 'Alerta de Tormenta',
      message:
        netPosition < 0
          ? `Gastos exceden ingresos por $${Math.abs(netPosition / 100).toFixed(0)}`
          : hasBudgets
            ? 'Presupuesto agotado. Evita compras grandes.'
            : 'Has gastado todo tu ingreso. ¡Cuidado!',
      color: 'from-purple-500 to-red-500',
      bgColor: 'bg-red-900/30',
    };
  }

  if (budgetUsagePercent >= 80) {
    return {
      emoji: '🌧️',
      status: 'Día Lluvioso',
      message: hasBudgets
        ? `Presupuesto al ${budgetUsagePercent.toFixed(0)}%. Cuidado con los gastos.`
        : `Has gastado ${budgetUsagePercent.toFixed(0)}% de tus ingresos. Ve con calma.`,
      color: 'from-gray-400 to-blue-500',
      bgColor: 'bg-blue-900/30',
    };
  }

  if (budgetUsagePercent >= 50) {
    return {
      emoji: '⛅',
      status: 'Parcialmente Nublado',
      message: `Puedes gastar ~$${safeToSpendDaily} por día. ¡Planifica bien!`,
      color: 'from-blue-400 to-cyan-400',
      bgColor: 'bg-cyan-900/30',
    };
  }

  // Good financial health
  if (income === 0 && expenses === 0) {
    return {
      emoji: '🌤️',
      status: 'Esperando Datos',
      message: 'Agrega tus ingresos y gastos para ver tu clima financiero.',
      color: 'from-gray-400 to-gray-500',
      bgColor: 'bg-gray-900/30',
    };
  }

  return {
    emoji: '☀️',
    status: 'Cielos Despejados',
    message:
      safeToSpendDaily > 0
        ? `¡Buen flujo de caja! Puedes gastar ~$${safeToSpendDaily} por día.`
        : '¡Excelente control! Sigue así.',
    color: 'from-yellow-400 to-orange-400',
    bgColor: 'bg-amber-900/30',
  };
}

export function FinancialWeather({
  transactions,
  envelopes,
}: FinancialWeatherProps) {
  const weather = calculateWeather(transactions, envelopes);

  // Calculate key metrics for display
  const income =
    transactions
      .filter((t) => t.type === 'income')
      .reduce((sum, t) => sum + t.amountCents, 0) / 100;

  const expenses =
    transactions
      .filter((t) => t.type === 'expense')
      .reduce((sum, t) => sum + Math.abs(t.amountCents), 0) / 100;

  const totalBudget =
    envelopes.reduce((sum, e) => sum + e.budgetCents, 0) / 100;
  const totalSpent = envelopes.reduce((sum, e) => sum + e.spentCents, 0) / 100;
  const remainingBudget = totalBudget - totalSpent;

  // Calculate days of runway (how many days can you continue spending at current rate)
  const avgDailySpend =
    transactions.length > 0 ? expenses / Math.max(new Date().getDate(), 1) : 0;

  // Use remaining budget if budgets exist, otherwise use remaining income
  const hasBudgets = totalBudget > 0;
  const netPosition = income - expenses;
  const availableFunds = hasBudgets ? remainingBudget : Math.max(0, netPosition);

  const daysOfRunway =
    avgDailySpend > 0 ? Math.floor(availableFunds / avgDailySpend) : income > 0 ? 999 : 0;

  return (
    <div
      className={`relative overflow-hidden rounded-2xl ${weather.bgColor} border border-gray-700/50 p-6`}
    >
      {/* Animated background glow */}
      <div
        className={`absolute inset-0 bg-gradient-to-br ${weather.color} opacity-10 blur-2xl`}
      />

      <div className="relative z-10">
        {/* Weather Icon and Status */}
        <div className="text-center mb-6">
          <div className="text-7xl mb-3 animate-pulse">{weather.emoji}</div>
          <h3
            className={`text-2xl font-bold bg-gradient-to-r ${weather.color} bg-clip-text text-transparent mb-2`}
          >
            {weather.status}
          </h3>
          <p className="text-gray-300">{weather.message}</p>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-3 gap-4 pt-4 border-t border-gray-700/50">
          <div className="text-center">
            <p className="text-2xl font-bold text-green-400">
              ${income.toLocaleString('es-MX', { maximumFractionDigits: 0 })}
            </p>
            <p className="text-xs text-gray-500">Ingresos</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-red-400">
              ${expenses.toLocaleString('es-MX', { maximumFractionDigits: 0 })}
            </p>
            <p className="text-xs text-gray-500">Gastos</p>
          </div>
          <div className="text-center">
            <p
              className={`text-2xl font-bold ${daysOfRunway < 7 ? 'text-red-400' : daysOfRunway < 14 ? 'text-yellow-400' : 'text-cyan-400'}`}
            >
              {daysOfRunway > 30 ? '30+' : daysOfRunway}
            </p>
            <p className="text-xs text-gray-500">Días de Pista</p>
          </div>
        </div>

        {/* Budget or Income Progress Bar */}
        {totalBudget > 0 ? (
          <div className="mt-4 pt-4 border-t border-gray-700/50">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-400">Presupuesto Usado</span>
              <span className="text-white font-medium">
                $
                {totalSpent.toLocaleString('es-MX', {
                  maximumFractionDigits: 0,
                })}{' '}
                / $
                {totalBudget.toLocaleString('es-MX', {
                  maximumFractionDigits: 0,
                })}
              </span>
            </div>
            <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
              <div
                className={`h-full bg-gradient-to-r ${weather.color} transition-all duration-500`}
                style={{
                  width: `${Math.min((totalSpent / totalBudget) * 100, 100)}%`,
                }}
              />
            </div>
          </div>
        ) : income > 0 ? (
          <div className="mt-4 pt-4 border-t border-gray-700/50">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-400">Ingreso Gastado</span>
              <span className="text-white font-medium">
                $
                {expenses.toLocaleString('es-MX', {
                  maximumFractionDigits: 0,
                })}{' '}
                / $
                {income.toLocaleString('es-MX', {
                  maximumFractionDigits: 0,
                })}
              </span>
            </div>
            <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
              <div
                className={`h-full bg-gradient-to-r ${weather.color} transition-all duration-500`}
                style={{
                  width: `${Math.min((expenses / income) * 100, 100)}%`,
                }}
              />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
