'use client';

import type { AdvisorDocumentContext } from '@/lib/api';

/**
 * Format cents as currency string
 */
function formatCurrency(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

interface InsightsPanelProps {
  documentContext: AdvisorDocumentContext;
  onClose: () => void;
}

/**
 * InsightsPanel - Display analysis results without importing
 *
 * Shows:
 * - Spending by category (pie chart / list)
 * - Top 5 largest transactions
 * - Detected recurring patterns
 * - Potential anomalies
 */
export function InsightsPanel({
  documentContext,
  onClose,
}: InsightsPanelProps) {
  const insights = documentContext.enrichment?.insights;
  const stats = documentContext.stats;

  if (!insights) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <p className="text-sm text-gray-500">No insights available.</p>
        <button
          onClick={onClose}
          className="mt-3 text-sm text-blue-600 hover:underline dark:text-blue-400"
        >
          Close
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-200 pb-3 dark:border-gray-700">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white">
          Document analysis
        </h3>
        <button
          onClick={onClose}
          className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          Close
        </button>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="Total expenses"
          value={formatCurrency(stats.totalExpenseCents)}
          subtext={`${stats.expenseCount} transactions`}
          color="red"
        />
        <StatCard
          label="Total income"
          value={formatCurrency(stats.totalIncomeCents)}
          subtext={`${stats.incomeCount} transactions`}
          color="green"
        />
        <StatCard
          label="Balance"
          value={formatCurrency(
            stats.totalIncomeCents - stats.totalExpenseCents
          )}
          subtext="Income - Expenses"
          color={
            stats.totalIncomeCents >= stats.totalExpenseCents ? 'green' : 'red'
          }
        />
        <StatCard
          label="Transfers"
          value={stats.transferCount.toString()}
          subtext="Detected"
          color="gray"
        />
      </div>

      {/* Spending by category */}
      {insights.spendingByCategory.length > 0 && (
        <Section title="Spending by category">
          <div className="space-y-2">
            {insights.spendingByCategory.slice(0, 8).map((cat, idx) => (
              <CategoryBar
                key={idx}
                name={cat.categoryName}
                amount={cat.totalCents}
                percentage={cat.percentage}
                count={cat.transactionCount}
              />
            ))}
          </div>
        </Section>
      )}

      {/* Largest expenses */}
      {insights.largestExpenses.length > 0 && (
        <Section title="Largest expenses">
          <div className="space-y-2">
            {insights.largestExpenses.slice(0, 5).map((tx, idx) => (
              <TransactionRow
                key={idx}
                description={
                  tx.sensitive ? '🔒 Hidden transaction' : tx.description
                }
                amount={tx.amountCents}
                date={tx.date}
                category={tx.categoryName}
                isCredit={false}
              />
            ))}
          </div>
        </Section>
      )}

      {/* Largest income */}
      {insights.largestIncome.length > 0 && (
        <Section title="Largest income">
          <div className="space-y-2">
            {insights.largestIncome.slice(0, 5).map((tx, idx) => (
              <TransactionRow
                key={idx}
                description={
                  tx.sensitive ? '🔒 Hidden transaction' : tx.description
                }
                amount={tx.amountCents}
                date={tx.date}
                category={tx.categoryName}
                isCredit={true}
              />
            ))}
          </div>
        </Section>
      )}

      {/* Recurring patterns */}
      {insights.recurringPatterns.length > 0 && (
        <Section title="Recurring patterns">
          <div className="space-y-2">
            {insights.recurringPatterns.slice(0, 5).map((pattern, idx) => (
              <RecurringPatternRow
                key={idx}
                description={pattern.description}
                avgAmount={pattern.avgAmountCents}
                frequency={pattern.frequency}
                occurrences={pattern.occurrences}
                isExpense={pattern.isExpense}
              />
            ))}
          </div>
        </Section>
      )}

      {/* Anomalies */}
      {insights.anomalies.length > 0 && (
        <Section title="Unusual transactions">
          <div className="space-y-2">
            {insights.anomalies.slice(0, 5).map((anomaly, idx) => (
              <AnomalyRow
                key={idx}
                description={anomaly.description}
                amount={anomaly.amountCents}
                date={anomaly.date}
                reason={anomaly.reason}
                details={anomaly.details}
              />
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}

// ============================================================================
// Sub-components
// ============================================================================

function StatCard({
  label,
  value,
  subtext,
  color,
}: {
  label: string;
  value: string;
  subtext: string;
  color: 'red' | 'green' | 'gray';
}) {
  const colorClasses = {
    red: 'text-red-600 dark:text-red-400',
    green: 'text-green-600 dark:text-green-400',
    gray: 'text-gray-600 dark:text-gray-400',
  };

  return (
    <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-800/50">
      <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
      <p className={`text-lg font-semibold ${colorClasses[color]}`}>{value}</p>
      <p className="text-xs text-gray-400 dark:text-gray-500">{subtext}</p>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h4 className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
        {title}
      </h4>
      {children}
    </div>
  );
}

function CategoryBar({
  name,
  amount,
  percentage,
  count,
}: {
  name: string;
  amount: number;
  percentage: number;
  count: number;
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-700 dark:text-gray-300">{name}</span>
          <span className="font-medium text-gray-900 dark:text-white">
            {formatCurrency(amount)}
          </span>
        </div>
        <div className="mt-1 h-1.5 w-full rounded-full bg-gray-200 dark:bg-gray-700">
          <div
            className="h-1.5 rounded-full bg-blue-500"
            style={{ width: `${Math.min(percentage, 100)}%` }}
          />
        </div>
      </div>
      <span className="text-xs text-gray-400 dark:text-gray-500">
        {count} tx
      </span>
    </div>
  );
}

function TransactionRow({
  description,
  amount,
  date,
  category,
  isCredit,
}: {
  description: string;
  amount: number;
  date: string | null;
  category: string | null;
  isCredit: boolean;
}) {
  return (
    <div className="flex items-center justify-between rounded-md bg-gray-50 px-3 py-2 dark:bg-gray-800/50">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-gray-700 dark:text-gray-300">
          {description}
        </p>
        <p className="text-xs text-gray-400 dark:text-gray-500">
          {date && <span>{date}</span>}
          {category && <span> · {category}</span>}
        </p>
      </div>
      <span
        className={`ml-2 font-medium ${
          isCredit
            ? 'text-green-600 dark:text-green-400'
            : 'text-red-600 dark:text-red-400'
        }`}
      >
        {isCredit ? '+' : '-'}
        {formatCurrency(amount)}
      </span>
    </div>
  );
}

function RecurringPatternRow({
  description,
  avgAmount,
  frequency,
  occurrences,
  isExpense,
}: {
  description: string;
  avgAmount: number;
  frequency: string;
  occurrences: number;
  isExpense: boolean;
}) {
  const frequencyLabels: Record<string, string> = {
    weekly: 'Weekly',
    biweekly: 'Biweekly',
    monthly: 'Monthly',
    irregular: 'Irregular',
  };

  return (
    <div className="flex items-center justify-between rounded-md bg-gray-50 px-3 py-2 dark:bg-gray-800/50">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-gray-700 dark:text-gray-300">
          {description}
        </p>
        <p className="text-xs text-gray-400 dark:text-gray-500">
          {frequencyLabels[frequency] || frequency} · {occurrences} times
        </p>
      </div>
      <span
        className={`ml-2 font-medium ${
          isExpense
            ? 'text-red-600 dark:text-red-400'
            : 'text-green-600 dark:text-green-400'
        }`}
      >
        ~{formatCurrency(avgAmount)}
      </span>
    </div>
  );
}

function AnomalyRow({
  description,
  amount,
  date,
  reason,
  details,
}: {
  description: string;
  amount: number;
  date: string | null;
  reason: string;
  details?: string;
}) {
  const reasonLabels: Record<string, { label: string; color: string }> = {
    unusually_high: {
      label: 'High amount',
      color: 'text-orange-600 dark:text-orange-400',
    },
    unusually_low: {
      label: 'Low amount',
      color: 'text-yellow-600 dark:text-yellow-400',
    },
    round_number: {
      label: 'Round number',
      color: 'text-blue-600 dark:text-blue-400',
    },
    potential_duplicate: {
      label: 'Possible duplicate',
      color: 'text-red-600 dark:text-red-400',
    },
  };

  const reasonInfo = reasonLabels[reason] || {
    label: reason,
    color: 'text-gray-600',
  };

  return (
    <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 dark:border-amber-900/50 dark:bg-amber-900/20">
      <div className="flex items-center justify-between">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm text-gray-700 dark:text-gray-300">
            {description}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {date && <span>{date} · </span>}
            <span className={reasonInfo.color}>{reasonInfo.label}</span>
            {details && <span> · {details}</span>}
          </p>
        </div>
        <span className="ml-2 font-medium text-gray-900 dark:text-white">
          {formatCurrency(amount)}
        </span>
      </div>
    </div>
  );
}
