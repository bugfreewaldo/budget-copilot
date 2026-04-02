'use client';

import { useState, useEffect } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { ConfirmModal } from '@/components/ui/ConfirmModal';

// ============================================================================
// TYPES
// ============================================================================

interface ScheduledBill {
  id: string;
  name: string;
  type: string;
  amountCents: number;
  dueDay: number;
  frequency: string;
  status: string;
  nextDueDate: string | null;
  autoPay: boolean | null;
  notes: string | null;
}

interface ScheduledIncomeItem {
  id: string;
  name: string;
  source: string;
  amountCents: number;
  payDay: number;
  frequency: string;
  status: string;
  nextPayDate: string | null;
  isVariable: boolean | null;
  notes: string | null;
}

interface DebtSummary {
  totalBalanceCents: number;
  totalMinPaymentCents: number;
  count: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const BILL_TYPES = [
  { value: 'mortgage', label: 'Mortgage', emoji: '🏠' },
  { value: 'rent', label: 'Rent', emoji: '🏢' },
  { value: 'auto_loan', label: 'Auto', emoji: '🚗' },
  { value: 'credit_card', label: 'Credit Card', emoji: '💳' },
  { value: 'personal_loan', label: 'Personal Loan', emoji: '💰' },
  { value: 'student_loan', label: 'Student Loan', emoji: '🎓' },
  { value: 'utility', label: 'Utilities', emoji: '💡' },
  { value: 'insurance', label: 'Insurance', emoji: '🛡️' },
  { value: 'subscription', label: 'Subscription', emoji: '📺' },
  { value: 'other', label: 'Other', emoji: '📝' },
];

const INCOME_SOURCES = [
  { value: 'salary', label: 'Salary', emoji: '💼' },
  { value: 'freelance', label: 'Freelance', emoji: '💻' },
  { value: 'business', label: 'Business', emoji: '🏪' },
  { value: 'investment', label: 'Investments', emoji: '📈' },
  { value: 'rental', label: 'Rent', emoji: '🏠' },
  { value: 'side_hustle', label: 'Side Hustle', emoji: '🌙' },
  { value: 'bonus', label: 'Bonus', emoji: '🎁' },
  { value: 'other', label: 'Other', emoji: '💵' },
];

const FREQUENCIES = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Biweekly' },
  { value: 'semimonthly', label: 'Semi-monthly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'annually', label: 'Annual' },
];

// ============================================================================
// COMPONENT
// ============================================================================

export default function RecurrentesPage(): React.ReactElement {
  const [activeTab, setActiveTab] = useState<'bills' | 'income'>('bills');
  const [bills, setBills] = useState<ScheduledBill[]>([]);
  const [incomes, setIncomes] = useState<ScheduledIncomeItem[]>([]);
  const [debtSummary, setDebtSummary] = useState<DebtSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showIdeas, setShowIdeas] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<
    ScheduledBill | ScheduledIncomeItem | null
  >(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{
    item: ScheduledBill | ScheduledIncomeItem;
    type: 'bill' | 'income';
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Form state for bills
  const [billForm, setBillForm] = useState({
    name: '',
    type: 'other',
    amount: '',
    dueDay: '1',
    frequency: 'monthly',
    autoPay: false,
    notes: '',
  });

  // Form state for income
  const [incomeForm, setIncomeForm] = useState({
    name: '',
    source: 'salary',
    amount: '',
    payDay: '15',
    frequency: 'monthly',
    isVariable: false,
    notes: '',
  });

  // Load data
  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setIsLoading(true);
    try {
      const [billsRes, incomesRes, debtsRes] = await Promise.all([
        fetch('/api/v1/scheduled-bills'),
        fetch('/api/v1/scheduled-income'),
        fetch('/api/v1/debts?status=active'),
      ]);

      if (billsRes.ok) {
        const billsData = await billsRes.json();
        setBills(billsData.data || []);
      }

      if (incomesRes.ok) {
        const incomesData = await incomesRes.json();
        setIncomes(incomesData.data || []);
      }

      if (debtsRes.ok) {
        const debtsData = await debtsRes.json();
        setDebtSummary(debtsData.summary || null);
      }
    } catch (error) {
      console.error('Error loading recurring items:', error);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSaveBill() {
    if (!billForm.name || !billForm.amount) return;

    const amountCents = Math.round(parseFloat(billForm.amount) * 100);
    const dueDay = parseInt(billForm.dueDay);

    // Calculate next due date
    const today = new Date();
    const nextDueDate = new Date(today.getFullYear(), today.getMonth(), dueDay);
    if (nextDueDate <= today) {
      nextDueDate.setMonth(nextDueDate.getMonth() + 1);
    }

    const payload = {
      name: billForm.name,
      type: billForm.type,
      amountCents,
      dueDay,
      frequency: billForm.frequency,
      autoPay: billForm.autoPay,
      notes: billForm.notes || null,
      nextDueDate: nextDueDate.toISOString().split('T')[0],
    };

    try {
      if (editingItem && 'dueDay' in editingItem) {
        // Update existing bill
        await fetch('/api/v1/scheduled-bills', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingItem.id, ...payload }),
        });
      } else {
        // Create new bill
        await fetch('/api/v1/scheduled-bills', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }

      resetForm();
      loadData();
    } catch (error) {
      console.error('Error saving bill:', error);
    }
  }

  async function handleSaveIncome() {
    if (!incomeForm.name || !incomeForm.amount) return;

    const amountCents = Math.round(parseFloat(incomeForm.amount) * 100);
    const payDay = parseInt(incomeForm.payDay);

    // Calculate next pay date
    const today = new Date();
    const nextPayDate = new Date(today.getFullYear(), today.getMonth(), payDay);
    if (nextPayDate <= today) {
      nextPayDate.setMonth(nextPayDate.getMonth() + 1);
    }

    const payload = {
      name: incomeForm.name,
      source: incomeForm.source,
      amountCents,
      payDay,
      frequency: incomeForm.frequency,
      isVariable: incomeForm.isVariable,
      notes: incomeForm.notes || null,
      nextPayDate: nextPayDate.toISOString().split('T')[0],
    };

    try {
      if (editingItem && 'payDay' in editingItem) {
        // Update existing income
        await fetch('/api/v1/scheduled-income', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingItem.id, ...payload }),
        });
      } else {
        // Create new income
        await fetch('/api/v1/scheduled-income', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }

      resetForm();
      loadData();
    } catch (error) {
      console.error('Error saving income:', error);
    }
  }

  async function handleDelete() {
    if (!deleteConfirm) return;

    setIsDeleting(true);
    try {
      const endpoint =
        deleteConfirm.type === 'bill'
          ? `/api/v1/scheduled-bills/${deleteConfirm.item.id}`
          : `/api/v1/scheduled-income/${deleteConfirm.item.id}`;

      await fetch(endpoint, { method: 'DELETE' });
      setDeleteConfirm(null);
      loadData();
    } catch (error) {
      console.error('Error deleting item:', error);
    } finally {
      setIsDeleting(false);
    }
  }

  function handleEdit(
    item: ScheduledBill | ScheduledIncomeItem,
    type: 'bill' | 'income'
  ) {
    setEditingItem(item);
    setShowForm(true);

    if (type === 'bill') {
      const bill = item as ScheduledBill;
      setBillForm({
        name: bill.name,
        type: bill.type,
        amount: (bill.amountCents / 100).toString(),
        dueDay: bill.dueDay.toString(),
        frequency: bill.frequency,
        autoPay: bill.autoPay || false,
        notes: bill.notes || '',
      });
      setActiveTab('bills');
    } else {
      const income = item as ScheduledIncomeItem;
      setIncomeForm({
        name: income.name,
        source: income.source,
        amount: (income.amountCents / 100).toString(),
        payDay: income.payDay.toString(),
        frequency: income.frequency,
        isVariable: income.isVariable || false,
        notes: income.notes || '',
      });
      setActiveTab('income');
    }
  }

  function resetForm() {
    setShowForm(false);
    setEditingItem(null);
    setBillForm({
      name: '',
      type: 'other',
      amount: '',
      dueDay: '1',
      frequency: 'monthly',
      autoPay: false,
      notes: '',
    });
    setIncomeForm({
      name: '',
      source: 'salary',
      amount: '',
      payDay: '15',
      frequency: 'monthly',
      isVariable: false,
      notes: '',
    });
  }

  function formatCurrency(cents: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(cents / 100);
  }

  function getTypeInfo(type: string, isBill: boolean) {
    const list = isBill ? BILL_TYPES : INCOME_SOURCES;
    return list.find((t) => t.value === type) || { label: type, emoji: '📝' };
  }

  function getFrequencyLabel(freq: string) {
    return FREQUENCIES.find((f) => f.value === freq)?.label || freq;
  }

  // Calculate totals
  const totalMonthlyBills = bills
    .filter((b) => b.status === 'active')
    .reduce((sum, b) => {
      let multiplier = 1;
      if (b.frequency === 'weekly') multiplier = 4;
      if (b.frequency === 'biweekly') multiplier = 2;
      if (b.frequency === 'quarterly') multiplier = 1 / 3;
      if (b.frequency === 'annually') multiplier = 1 / 12;
      return sum + b.amountCents * multiplier;
    }, 0);

  const totalMonthlyIncome = incomes
    .filter((i) => i.status === 'active')
    .reduce((sum, i) => {
      let multiplier = 1;
      if (i.frequency === 'weekly') multiplier = 4;
      if (i.frequency === 'biweekly') multiplier = 2;
      if (i.frequency === 'semimonthly') multiplier = 2;
      return sum + i.amountCents * multiplier;
    }, 0);

  return (
    <Sidebar>
      <div className="min-h-screen bg-gray-950 p-4 lg:p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">
            <span className="mr-2">🔄</span>
            Recurring Transactions
          </h1>
          <p className="text-gray-400">
            Manage your fixed payments and income for better financial control
          </p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-gradient-to-br from-red-500/20 to-red-600/10 rounded-xl p-6 border border-red-500/30">
            <div className="text-red-400 text-sm font-medium mb-1">
              Monthly Fixed Expenses
            </div>
            <div className="text-2xl font-bold text-white">
              {formatCurrency(totalMonthlyBills)}
            </div>
            <div className="text-gray-400 text-sm mt-1">
              {bills.filter((b) => b.status === 'active').length} active
              payments
            </div>
          </div>

          <div className="bg-gradient-to-br from-green-500/20 to-green-600/10 rounded-xl p-6 border border-green-500/30">
            <div className="text-green-400 text-sm font-medium mb-1">
              Monthly Fixed Income
            </div>
            <div className="text-2xl font-bold text-white">
              {formatCurrency(totalMonthlyIncome)}
            </div>
            <div className="text-gray-400 text-sm mt-1">
              {incomes.filter((i) => i.status === 'active').length} active
              income
            </div>
          </div>

          <div className="bg-gradient-to-br from-cyan-500/20 to-purple-500/10 rounded-xl p-6 border border-cyan-500/30">
            <div className="text-cyan-400 text-sm font-medium mb-1">
              Monthly Net Balance
            </div>
            <div
              className={`text-2xl font-bold ${totalMonthlyIncome - totalMonthlyBills >= 0 ? 'text-green-400' : 'text-red-400'}`}
            >
              {formatCurrency(totalMonthlyIncome - totalMonthlyBills)}
            </div>
            <div className="text-gray-400 text-sm mt-1">
              Income - Fixed expenses
            </div>
          </div>
        </div>

        {/* Financial Tips Section */}
        {totalMonthlyIncome > 0 && (
          <div className="bg-gradient-to-br from-purple-500/10 to-indigo-500/10 rounded-xl border border-purple-500/20 mb-8 overflow-hidden">
            <button
              onClick={() => setShowIdeas(!showIdeas)}
              className="w-full flex items-center justify-between p-6 text-left hover:bg-white/5 transition-colors"
            >
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <span>💡</span> Ideas for Your Monthly Balance
              </h2>
              <svg
                className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${showIdeas ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>

            {showIdeas && (
              <div className="px-6 pb-6">
                {(() => {
                  const netBalance =
                    (totalMonthlyIncome - totalMonthlyBills) / 100;
                  const monthlyExpenses = totalMonthlyBills / 100;
                  const emergencyFund3Months = monthlyExpenses * 3;
                  const emergencyFund6Months = monthlyExpenses * 6;
                  const hasDebt = debtSummary && debtSummary.count > 0;
                  const totalDebt = hasDebt
                    ? debtSummary.totalBalanceCents / 100
                    : 0;
                  const minPayment = hasDebt
                    ? debtSummary.totalMinPaymentCents / 100
                    : 0;

                  // Allocation percentages (based on common financial advice)
                  const savingsPercent = hasDebt ? 20 : 30;
                  const investPercent = hasDebt ? 10 : 20;
                  const debtPercent = hasDebt ? 30 : 0;
                  const emergencyPercent = 20;

                  const allocatedSavings = netBalance * (savingsPercent / 100);
                  const allocatedInvest = netBalance * (investPercent / 100);
                  const allocatedDebt = netBalance * (debtPercent / 100);
                  const allocatedEmergency =
                    netBalance * (emergencyPercent / 100);

                  if (netBalance <= 0) {
                    return (
                      <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                        <p className="text-red-400 font-medium mb-2">
                          Your net balance is negative or zero
                        </p>
                        <p className="text-gray-300 text-sm">
                          Consider reducing expenses or finding additional
                          sources of income before thinking about investments or
                          savings.
                        </p>
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-4">
                      {/* Debt Strategy */}
                      {hasDebt && (
                        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
                          <h3 className="text-amber-400 font-medium mb-2 flex items-center gap-2">
                            <span>💳</span> Debt Strategy
                          </h3>
                          <div className="text-gray-300 text-sm space-y-2">
                            <p>
                              You have{' '}
                              <span className="text-white font-medium">
                                {debtSummary.count} debt(s)
                              </span>{' '}
                              with a total of{' '}
                              <span className="text-red-400 font-medium">
                                {formatCurrency(totalDebt * 100)}
                              </span>
                            </p>
                            {minPayment > 0 && (
                              <p>
                                Monthly minimum payment:{' '}
                                <span className="text-amber-400 font-medium">
                                  {formatCurrency(minPayment * 100)}
                                </span>
                              </p>
                            )}
                            <div className="mt-3 p-3 bg-gray-900/50 rounded-lg">
                              <p className="text-cyan-400 font-medium mb-1">
                                Accelerated payment scenario:
                              </p>
                              <p>
                                If you allocate{' '}
                                <span className="text-green-400 font-medium">
                                  {formatCurrency(allocatedDebt * 100)}
                                </span>{' '}
                                (30% of your balance) extra to your debts each
                                month:
                              </p>
                              <ul className="list-disc list-inside mt-2 space-y-1 text-gray-400">
                                <li>
                                  You'll pay off your debt in approximately{' '}
                                  <span className="text-white">
                                    {Math.ceil(
                                      totalDebt / (allocatedDebt + minPayment)
                                    )}{' '}
                                    months
                                  </span>
                                </li>
                                <li>
                                  You'll save significant interest in the long
                                  run
                                </li>
                              </ul>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Emergency Fund */}
                      <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                        <h3 className="text-blue-400 font-medium mb-2 flex items-center gap-2">
                          <span>🛡️</span> Emergency Fund
                        </h3>
                        <div className="text-gray-300 text-sm space-y-2">
                          <p>
                            Based on your monthly fixed expenses, your emergency
                            fund should be:
                          </p>
                          <div className="grid grid-cols-2 gap-3 mt-2">
                            <div className="p-3 bg-gray-900/50 rounded-lg">
                              <p className="text-xs text-gray-400">
                                Minimum (3 months)
                              </p>
                              <p className="text-lg font-bold text-blue-400">
                                {formatCurrency(emergencyFund3Months * 100)}
                              </p>
                            </div>
                            <div className="p-3 bg-gray-900/50 rounded-lg">
                              <p className="text-xs text-gray-400">
                                Ideal (6 months)
                              </p>
                              <p className="text-lg font-bold text-cyan-400">
                                {formatCurrency(emergencyFund6Months * 100)}
                              </p>
                            </div>
                          </div>
                          <p className="mt-2">
                            Saving{' '}
                            <span className="text-green-400 font-medium">
                              {formatCurrency(allocatedEmergency * 100)}
                            </span>{' '}
                            (20% of your balance) monthly:
                          </p>
                          <ul className="list-disc list-inside text-gray-400">
                            <li>
                              You'll reach the minimum in{' '}
                              <span className="text-white">
                                {Math.ceil(
                                  emergencyFund3Months / allocatedEmergency
                                )}{' '}
                                months
                              </span>
                            </li>
                            <li>
                              You'll reach the ideal in{' '}
                              <span className="text-white">
                                {Math.ceil(
                                  emergencyFund6Months / allocatedEmergency
                                )}{' '}
                                months
                              </span>
                            </li>
                          </ul>
                        </div>
                      </div>

                      {/* Investment Ideas */}
                      <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
                        <h3 className="text-green-400 font-medium mb-2 flex items-center gap-2">
                          <span>📈</span> Investment Ideas
                        </h3>
                        <div className="text-gray-300 text-sm space-y-2">
                          <p>
                            Con{' '}
                            <span className="text-green-400 font-medium">
                              {formatCurrency(allocatedInvest * 100)}
                            </span>{' '}
                            ({investPercent}% of your balance) you can consider:
                          </p>
                          <div className="mt-3 space-y-2">
                            <div className="p-3 bg-gray-900/50 rounded-lg flex items-start gap-3">
                              <span className="text-xl">🏦</span>
                              <div>
                                <p className="text-white font-medium">
                                  Treasury Bills / Bonds
                                </p>
                                <p className="text-xs text-gray-400">
                                  Low risk, fixed return, ideal for beginners
                                </p>
                              </div>
                            </div>
                            <div className="p-3 bg-gray-900/50 rounded-lg flex items-start gap-3">
                              <span className="text-xl">📊</span>
                              <div>
                                <p className="text-white font-medium">
                                  Index Funds (ETFs)
                                </p>
                                <p className="text-xs text-gray-400">
                                  Automatic diversification, moderate risk,
                                  long-term growth
                                </p>
                              </div>
                            </div>
                            <div className="p-3 bg-gray-900/50 rounded-lg flex items-start gap-3">
                              <span className="text-xl">🌎</span>
                              <div>
                                <p className="text-white font-medium">
                                  Stock Market
                                </p>
                                <p className="text-xs text-gray-400">
                                  Higher risk, higher return potential, requires
                                  financial education
                                </p>
                              </div>
                            </div>
                          </div>
                          <p className="text-xs text-gray-500 mt-3 italic">
                            * These are general ideas. Consult a financial
                            advisor before investing.
                          </p>
                        </div>
                      </div>

                      {/* Suggested Allocation */}
                      <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4">
                        <h3 className="text-purple-400 font-medium mb-2 flex items-center gap-2">
                          <span>🎯</span> Suggested Distribution of Your Balance
                        </h3>
                        <p className="text-gray-400 text-sm mb-3">
                          Available balance:{' '}
                          <span className="text-white font-bold">
                            {formatCurrency(netBalance * 100)}
                          </span>
                        </p>
                        <div className="space-y-2">
                          {hasDebt && (
                            <div className="flex items-center justify-between p-2 bg-gray-900/50 rounded">
                              <span className="text-gray-300">
                                Extra debt payments (30%)
                              </span>
                              <span className="text-amber-400 font-medium">
                                {formatCurrency(allocatedDebt * 100)}
                              </span>
                            </div>
                          )}
                          <div className="flex items-center justify-between p-2 bg-gray-900/50 rounded">
                            <span className="text-gray-300">
                              Emergency fund (20%)
                            </span>
                            <span className="text-blue-400 font-medium">
                              {formatCurrency(allocatedEmergency * 100)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between p-2 bg-gray-900/50 rounded">
                            <span className="text-gray-300">
                              General savings ({savingsPercent}%)
                            </span>
                            <span className="text-cyan-400 font-medium">
                              {formatCurrency(allocatedSavings * 100)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between p-2 bg-gray-900/50 rounded">
                            <span className="text-gray-300">
                              Investments ({investPercent}%)
                            </span>
                            <span className="text-green-400 font-medium">
                              {formatCurrency(allocatedInvest * 100)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between p-2 bg-gray-800/50 rounded border-t border-gray-700 mt-2">
                            <span className="text-gray-300">Discretionary</span>
                            <span className="text-gray-400 font-medium">
                              {formatCurrency(
                                (netBalance -
                                  allocatedDebt -
                                  allocatedEmergency -
                                  allocatedSavings -
                                  allocatedInvest) *
                                  100
                              )}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        )}

        {/* Tabs and Add Button */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('bills')}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                activeTab === 'bills'
                  ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                  : 'bg-gray-800 text-gray-400 hover:text-white'
              }`}
            >
              💸 Expenses ({bills.length})
            </button>
            <button
              onClick={() => setActiveTab('income')}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                activeTab === 'income'
                  ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                  : 'bg-gray-800 text-gray-400 hover:text-white'
              }`}
            >
              💰 Income ({incomes.length})
            </button>
          </div>

          <button
            onClick={() => {
              resetForm();
              setShowForm(true);
            }}
            className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-purple-500 text-white rounded-lg font-medium hover:opacity-90 transition-opacity"
          >
            + Add {activeTab === 'bills' ? 'Expense' : 'Income'}
          </button>
        </div>

        {/* Form Modal */}
        {showForm && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-gray-900 rounded-xl border border-gray-800 w-full max-w-md max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-bold text-white">
                    {editingItem ? 'Edit' : 'Add'}{' '}
                    {activeTab === 'bills'
                      ? 'Recurring Expense'
                      : 'Recurring Income'}
                  </h2>
                  <button
                    onClick={resetForm}
                    className="text-gray-400 hover:text-white"
                  >
                    <svg
                      className="w-6 h-6"
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

                {activeTab === 'bills' ? (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">
                        Nombre
                      </label>
                      <input
                        type="text"
                        value={billForm.name}
                        onChange={(e) =>
                          setBillForm({ ...billForm, name: e.target.value })
                        }
                        placeholder="E.g.: Netflix, Utilities, Rent"
                        className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm text-gray-400 mb-1">
                        Tipo
                      </label>
                      <select
                        value={billForm.type}
                        onChange={(e) =>
                          setBillForm({ ...billForm, type: e.target.value })
                        }
                        className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
                      >
                        {BILL_TYPES.map((t) => (
                          <option key={t.value} value={t.value}>
                            {t.emoji} {t.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm text-gray-400 mb-1">
                        Monto
                      </label>
                      <input
                        type="number"
                        value={billForm.amount}
                        onChange={(e) =>
                          setBillForm({ ...billForm, amount: e.target.value })
                        }
                        placeholder="0.00"
                        step="0.01"
                        className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm text-gray-400 mb-1">
                          Pay day
                        </label>
                        <select
                          value={billForm.dueDay}
                          onChange={(e) =>
                            setBillForm({ ...billForm, dueDay: e.target.value })
                          }
                          className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
                        >
                          {Array.from({ length: 31 }, (_, i) => i + 1).map(
                            (day) => (
                              <option key={day} value={day}>
                                {day}
                              </option>
                            )
                          )}
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm text-gray-400 mb-1">
                          Frecuencia
                        </label>
                        <select
                          value={billForm.frequency}
                          onChange={(e) =>
                            setBillForm({
                              ...billForm,
                              frequency: e.target.value,
                            })
                          }
                          className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
                        >
                          {FREQUENCIES.map((f) => (
                            <option key={f.value} value={f.value}>
                              {f.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="autoPay"
                        checked={billForm.autoPay}
                        onChange={(e) =>
                          setBillForm({
                            ...billForm,
                            autoPay: e.target.checked,
                          })
                        }
                        className="w-4 h-4 rounded border-gray-700 bg-gray-800 text-cyan-500 focus:ring-cyan-500"
                      />
                      <label htmlFor="autoPay" className="text-gray-300">
                        Auto-pay
                      </label>
                    </div>

                    <div>
                      <label className="block text-sm text-gray-400 mb-1">
                        Notes (optional)
                      </label>
                      <textarea
                        value={billForm.notes}
                        onChange={(e) =>
                          setBillForm({ ...billForm, notes: e.target.value })
                        }
                        placeholder="Additional notes..."
                        rows={2}
                        className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-cyan-500 resize-none"
                      />
                    </div>

                    <button
                      onClick={handleSaveBill}
                      disabled={!billForm.name || !billForm.amount}
                      className="w-full py-3 bg-gradient-to-r from-cyan-500 to-purple-500 text-white rounded-lg font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {editingItem ? 'Save Changes' : 'Add Expense'}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">
                        Nombre
                      </label>
                      <input
                        type="text"
                        value={incomeForm.name}
                        onChange={(e) =>
                          setIncomeForm({ ...incomeForm, name: e.target.value })
                        }
                        placeholder="E.g.: Salary, Freelance"
                        className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm text-gray-400 mb-1">
                        Fuente
                      </label>
                      <select
                        value={incomeForm.source}
                        onChange={(e) =>
                          setIncomeForm({
                            ...incomeForm,
                            source: e.target.value,
                          })
                        }
                        className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
                      >
                        {INCOME_SOURCES.map((s) => (
                          <option key={s.value} value={s.value}>
                            {s.emoji} {s.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm text-gray-400 mb-1">
                        Monto
                      </label>
                      <input
                        type="number"
                        value={incomeForm.amount}
                        onChange={(e) =>
                          setIncomeForm({
                            ...incomeForm,
                            amount: e.target.value,
                          })
                        }
                        placeholder="0.00"
                        step="0.01"
                        className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm text-gray-400 mb-1">
                          Pay day
                        </label>
                        <select
                          value={incomeForm.payDay}
                          onChange={(e) =>
                            setIncomeForm({
                              ...incomeForm,
                              payDay: e.target.value,
                            })
                          }
                          className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
                        >
                          {Array.from({ length: 31 }, (_, i) => i + 1).map(
                            (day) => (
                              <option key={day} value={day}>
                                {day}
                              </option>
                            )
                          )}
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm text-gray-400 mb-1">
                          Frecuencia
                        </label>
                        <select
                          value={incomeForm.frequency}
                          onChange={(e) =>
                            setIncomeForm({
                              ...incomeForm,
                              frequency: e.target.value,
                            })
                          }
                          className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
                        >
                          {FREQUENCIES.filter((f) =>
                            [
                              'weekly',
                              'biweekly',
                              'semimonthly',
                              'monthly',
                            ].includes(f.value)
                          ).map((f) => (
                            <option key={f.value} value={f.value}>
                              {f.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="isVariable"
                        checked={incomeForm.isVariable}
                        onChange={(e) =>
                          setIncomeForm({
                            ...incomeForm,
                            isVariable: e.target.checked,
                          })
                        }
                        className="w-4 h-4 rounded border-gray-700 bg-gray-800 text-cyan-500 focus:ring-cyan-500"
                      />
                      <label htmlFor="isVariable" className="text-gray-300">
                        Variable amount (aproximado)
                      </label>
                    </div>

                    <div>
                      <label className="block text-sm text-gray-400 mb-1">
                        Notes (optional)
                      </label>
                      <textarea
                        value={incomeForm.notes}
                        onChange={(e) =>
                          setIncomeForm({
                            ...incomeForm,
                            notes: e.target.value,
                          })
                        }
                        placeholder="Additional notes..."
                        rows={2}
                        className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-cyan-500 resize-none"
                      />
                    </div>

                    <button
                      onClick={handleSaveIncome}
                      disabled={!incomeForm.name || !incomeForm.amount}
                      className="w-full py-3 bg-gradient-to-r from-cyan-500 to-purple-500 text-white rounded-lg font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {editingItem ? 'Save Changes' : 'Add Income'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* List */}
        {isLoading ? (
          <div className="flex justify-center items-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-cyan-500"></div>
          </div>
        ) : (
          <div className="space-y-3">
            {activeTab === 'bills' ? (
              bills.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <div className="text-4xl mb-4">💸</div>
                  <p>You don't have any recurring expenses</p>
                  <p className="text-sm mt-1">
                    Add your fixed payments for better control
                  </p>
                </div>
              ) : (
                bills.map((bill) => {
                  const typeInfo = getTypeInfo(bill.type, true);
                  return (
                    <div
                      key={bill.id}
                      className="bg-gray-900/50 rounded-xl p-4 border border-gray-800 hover:border-gray-700 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{typeInfo.emoji}</span>
                          <div>
                            <div className="font-medium text-white">
                              {bill.name}
                            </div>
                            <div className="text-sm text-gray-400">
                              {typeInfo.label} - Dia {bill.dueDay} -{' '}
                              {getFrequencyLabel(bill.frequency)}
                              {bill.autoPay && (
                                <span className="ml-2 text-green-400">
                                  Auto
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <div className="font-bold text-red-400">
                              -{formatCurrency(bill.amountCents)}
                            </div>
                            {bill.nextDueDate && (
                              <div className="text-xs text-gray-500">
                                Proximo: {bill.nextDueDate}
                              </div>
                            )}
                          </div>
                          <div className="flex gap-1">
                            <button
                              onClick={() => handleEdit(bill, 'bill')}
                              className="p-2 text-gray-400 hover:text-white transition-colors"
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
                                  d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                                />
                              </svg>
                            </button>
                            <button
                              onClick={() =>
                                setDeleteConfirm({ item: bill, type: 'bill' })
                              }
                              className="p-2 text-gray-400 hover:text-red-400 transition-colors"
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
                                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                />
                              </svg>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )
            ) : incomes.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <div className="text-4xl mb-4">💰</div>
                <p>You don't have any recurring income</p>
                <p className="text-sm mt-1">
                  Add your salary and other income sources
                </p>
              </div>
            ) : (
              incomes.map((income) => {
                const sourceInfo = getTypeInfo(income.source, false);
                return (
                  <div
                    key={income.id}
                    className="bg-gray-900/50 rounded-xl p-4 border border-gray-800 hover:border-gray-700 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{sourceInfo.emoji}</span>
                        <div>
                          <div className="font-medium text-white">
                            {income.name}
                          </div>
                          <div className="text-sm text-gray-400">
                            {sourceInfo.label} - Dia {income.payDay} -{' '}
                            {getFrequencyLabel(income.frequency)}
                            {income.isVariable && (
                              <span className="ml-2 text-yellow-400">
                                ~Variable
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <div className="font-bold text-green-400">
                            +{formatCurrency(income.amountCents)}
                          </div>
                          {income.nextPayDate && (
                            <div className="text-xs text-gray-500">
                              Proximo: {income.nextPayDate}
                            </div>
                          )}
                        </div>
                        <div className="flex gap-1">
                          <button
                            onClick={() => handleEdit(income, 'income')}
                            className="p-2 text-gray-400 hover:text-white transition-colors"
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
                                d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                              />
                            </svg>
                          </button>
                          <button
                            onClick={() =>
                              setDeleteConfirm({ item: income, type: 'income' })
                            }
                            className="p-2 text-gray-400 hover:text-red-400 transition-colors"
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
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                              />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Delete Confirmation Modal */}
        <ConfirmModal
          isOpen={deleteConfirm !== null}
          onClose={() => setDeleteConfirm(null)}
          onConfirm={handleDelete}
          title={
            deleteConfirm?.type === 'bill'
              ? 'Delete Recurring Expense'
              : 'Delete Recurring Income'
          }
          message={`Are you sure you want to delete "${deleteConfirm?.item.name}"? This action cannot be undone.`}
          confirmText="Delete"
          cancelText="Cancel"
          variant="danger"
          isLoading={isDeleting}
        />
      </div>
    </Sidebar>
  );
}
