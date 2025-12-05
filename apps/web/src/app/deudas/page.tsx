'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useDebts, useDebtStrategies } from '@/lib/hooks';
import {
  createDebt,
  updateDebt,
  deleteDebt,
  recordDebtPayment,
  type Debt,
  type DebtType,
  type DebtStatus,
} from '@/lib/api';
import { Sidebar } from '@/components/layout';
import { ConfirmModal } from '@/components/ui/ConfirmModal';

const DEBT_TYPE_LABELS: Record<DebtType, { label: string; emoji: string }> = {
  credit_card: { label: 'Tarjeta de Crédito', emoji: '💳' },
  personal_loan: { label: 'Préstamo Personal', emoji: '💰' },
  auto_loan: { label: 'Préstamo Auto', emoji: '🚗' },
  mortgage: { label: 'Hipoteca', emoji: '🏠' },
  student_loan: { label: 'Préstamo Estudiantil', emoji: '🎓' },
  medical: { label: 'Deuda Médica', emoji: '🏥' },
  other: { label: 'Otro', emoji: '📋' },
};

const STATUS_LABELS: Record<DebtStatus, { label: string; color: string }> = {
  active: { label: 'Activa', color: 'bg-blue-500/20 text-blue-400' },
  paid_off: { label: 'Pagada', color: 'bg-green-500/20 text-green-400' },
  defaulted: { label: 'En Mora', color: 'bg-red-500/20 text-red-400' },
  deferred: { label: 'Diferida', color: 'bg-yellow-500/20 text-yellow-400' },
};

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function getDangerColor(score: number | null): string {
  if (score === null) return 'text-gray-400';
  if (score >= 80) return 'text-red-500';
  if (score >= 60) return 'text-orange-500';
  if (score >= 40) return 'text-yellow-500';
  return 'text-green-500';
}

function getDangerLabel(score: number | null): string {
  if (score === null) return 'Sin calcular';
  if (score >= 80) return 'Peligro Alto';
  if (score >= 60) return 'Peligro Medio';
  if (score >= 40) return 'Atención';
  return 'Bajo Control';
}

type PaymentStrategy = 'avalanche' | 'snowball';

// Calculate monthly payment needed to pay off debt in X months
function calculateMonthlyPayment(
  balanceCents: number,
  aprPercent: number,
  months: number
): number {
  if (months <= 0) return 0;
  const principal = balanceCents / 100;
  const monthlyRate = aprPercent / 100 / 12;

  if (monthlyRate === 0) {
    return principal / months;
  }

  // M = P * [r(1+r)^n] / [(1+r)^n - 1]
  const payment =
    (principal * (monthlyRate * Math.pow(1 + monthlyRate, months))) /
    (Math.pow(1 + monthlyRate, months) - 1);

  return payment;
}

// Calculate total interest paid over the loan period
function calculateTotalInterest(
  balanceCents: number,
  aprPercent: number,
  monthlyPayment: number,
  months: number
): number {
  const principal = balanceCents / 100;
  const totalPaid = monthlyPayment * months;
  return totalPaid - principal;
}

export default function DeudasPage() {
  const { debts, summary, isLoading, error, refresh } = useDebts();
  const { strategies } = useDebtStrategies();
  const [showAddModal, setShowAddModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState<Debt | null>(null);
  const [showCalculator, setShowCalculator] = useState<Debt | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Debt | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [calculatorYears, setCalculatorYears] = useState(1);
  const [selectedStrategy, setSelectedStrategy] = useState<PaymentStrategy>(
    () => {
      if (typeof window !== 'undefined') {
        return (
          (localStorage.getItem('debt-payment-strategy') as PaymentStrategy) ||
          'avalanche'
        );
      }
      return 'avalanche';
    }
  );

  // Save strategy selection to localStorage
  const handleSelectStrategy = (strategy: PaymentStrategy) => {
    setSelectedStrategy(strategy);
    localStorage.setItem('debt-payment-strategy', strategy);
  };

  // Form state for new debt
  const [newDebt, setNewDebt] = useState({
    name: '',
    type: 'credit_card' as DebtType,
    original_balance_cents: 0,
    current_balance_cents: 0,
    apr_percent: 0,
    minimum_payment_cents: 0,
    due_day: 1,
  });

  // Form state for payment
  const [payment, setPayment] = useState({
    amount: '',
    date: new Date().toISOString().split('T')[0]!,
  });

  const handleAddDebt = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await createDebt({
        name: newDebt.name,
        type: newDebt.type,
        original_balance_cents: Math.round(
          newDebt.original_balance_cents * 100
        ),
        current_balance_cents: Math.round(newDebt.current_balance_cents * 100),
        apr_percent: newDebt.apr_percent,
        minimum_payment_cents: Math.round(newDebt.minimum_payment_cents * 100),
        due_day: newDebt.due_day,
      });
      setShowAddModal(false);
      setNewDebt({
        name: '',
        type: 'credit_card',
        original_balance_cents: 0,
        current_balance_cents: 0,
        apr_percent: 0,
        minimum_payment_cents: 0,
        due_day: 1,
      });
      refresh();
    } catch (err) {
      console.error('Failed to add debt:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showPaymentModal) return;

    setIsSubmitting(true);
    try {
      await recordDebtPayment(showPaymentModal.id, {
        amount_cents: Math.round(parseFloat(payment.amount) * 100),
        payment_date: payment.date,
      });
      setShowPaymentModal(null);
      setPayment({ amount: '', date: new Date().toISOString().split('T')[0]! });
      refresh();
    } catch (err) {
      console.error('Failed to record payment:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteDebt = async () => {
    if (!deleteConfirm) return;
    setIsDeleting(true);
    try {
      await deleteDebt(deleteConfirm.id);
      setDeleteConfirm(null);
      refresh();
    } catch (err) {
      console.error('Failed to delete debt:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleMarkAsPaid = async (debt: Debt) => {
    try {
      await updateDebt(debt.id, {
        status: 'paid_off',
        current_balance_cents: 0,
      });
      refresh();
    } catch (err) {
      console.error('Failed to mark as paid:', err);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-red-500" />
      </div>
    );
  }

  if (error) {
    // Check if it's a network/API error - show user-friendly message
    const isNetworkError =
      error.message?.includes('fetch') || error.message?.includes('network');

    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center p-4">
        <div className="text-6xl mb-6">💀</div>
        <h2 className="text-2xl font-bold text-white mb-2">
          {isNetworkError ? 'API no disponible' : 'Error al cargar'}
        </h2>
        <p className="text-gray-400 text-center max-w-md mb-6">
          {isNetworkError
            ? 'El servidor no está disponible. Intenta recargar la página.'
            : 'Hubo un problema al cargar las deudas. Intenta recargar la página.'}
        </p>
        <div className="flex gap-4">
          <button
            onClick={() => refresh()}
            className="px-6 py-3 bg-red-600 hover:bg-red-500 rounded-lg transition-colors"
          >
            Reintentar
          </button>
          <Link
            href="/dashboard"
            className="px-6 py-3 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
          >
            Volver al Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <Sidebar>
      <div className="min-h-screen bg-gray-950 text-white">
        {/* Page Header */}
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 lg:py-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 lg:mb-8">
            <div>
              <h1 className="text-2xl lg:text-3xl font-bold bg-gradient-to-r from-red-400 to-orange-400 bg-clip-text text-transparent flex items-center gap-2">
                <span>💀</span> Copiloto de Deudas
              </h1>
              <p className="text-sm lg:text-base text-gray-400">
                Visualiza y destruye tus deudas
              </p>
            </div>
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500 rounded-xl text-sm lg:text-base font-medium transition-colors"
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
                  d="M12 4v16m8-8H4"
                />
              </svg>
              Agregar Deuda
            </button>
          </div>
        </div>

        <main className="max-w-6xl mx-auto px-4 sm:px-6 pb-8">
          {debts.length === 0 ? (
            /* Empty State */
            <div className="flex flex-col items-center justify-center py-20">
              <div className="text-8xl mb-6">💀</div>
              <h2 className="text-2xl font-bold mb-2">
                ¡Sin deudas registradas!
              </h2>
              <p className="text-gray-400 text-center max-w-md mb-8">
                Registra tus deudas para visualizar tu camino hacia la libertad
                financiera. Usa el copilot para agregar deudas de forma
                conversacional.
              </p>
              <div className="flex gap-4">
                <button
                  onClick={() => setShowAddModal(true)}
                  className="px-6 py-3 bg-red-600 hover:bg-red-500 rounded-lg transition-colors"
                >
                  Agregar mi primera deuda
                </button>
                <Link
                  href="/dashboard"
                  className="px-6 py-3 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
                >
                  Usar el Copilot
                </Link>
              </div>
            </div>
          ) : (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
                  <p className="text-gray-400 text-sm mb-1">Deuda Total</p>
                  <p className="text-3xl font-bold text-red-400">
                    {summary ? formatCurrency(summary.totalDebtCents) : '$0'}
                  </p>
                </div>
                <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
                  <p className="text-gray-400 text-sm mb-1">
                    Pago Mensual Mínimo
                  </p>
                  <p className="text-3xl font-bold text-orange-400">
                    {summary
                      ? formatCurrency(summary.totalMinPaymentCents)
                      : '$0'}
                  </p>
                </div>
                <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
                  <p className="text-gray-400 text-sm mb-1">Deudas Activas</p>
                  <p className="text-3xl font-bold text-cyan-400">
                    {summary?.activeCount ?? 0}
                  </p>
                </div>
                <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
                  <p className="text-gray-400 text-sm mb-1">
                    Fecha de Libertad
                  </p>
                  <p className="text-xl font-bold text-green-400">
                    {strategies?.avalanche?.monthsToPayoff
                      ? `${Math.ceil(strategies.avalanche.monthsToPayoff / 12)} años`
                      : 'Calcular...'}
                  </p>
                  <p className="text-xs text-gray-500">Con método avalancha</p>
                </div>
              </div>

              {/* Strategy Comparison */}
              {strategies && (
                <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6 mb-8">
                  <h2 className="text-lg font-semibold mb-2">
                    Estrategias de Pago
                  </h2>
                  <p className="text-sm text-gray-400 mb-4">
                    Selecciona tu estrategia preferida para pagar tus deudas
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Avalanche */}
                    <button
                      onClick={() => handleSelectStrategy('avalanche')}
                      className={`p-4 rounded-lg border text-left transition-all ${
                        selectedStrategy === 'avalanche'
                          ? 'border-cyan-500 bg-cyan-500/10 ring-2 ring-cyan-500/30'
                          : 'border-gray-700 hover:border-gray-600 hover:bg-gray-800/50'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-2xl">🏔️</span>
                        <div>
                          <h3 className="font-semibold">Método Avalancha</h3>
                          <p className="text-xs text-gray-400">
                            Paga primero la deuda con mayor APR
                          </p>
                        </div>
                        <div className="ml-auto flex flex-col items-end gap-1">
                          {selectedStrategy === 'avalanche' && (
                            <span className="px-2 py-1 bg-cyan-500/20 text-cyan-400 text-xs rounded font-medium">
                              ✓ Seleccionado
                            </span>
                          )}
                          {strategies.recommendation === 'avalanche' && (
                            <span className="px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded">
                              Recomendado
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-gray-400">Interés Total</p>
                          <p className="font-semibold text-orange-400">
                            {formatCurrency(
                              strategies.avalanche.totalInterestCents
                            )}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-400">Tiempo</p>
                          <p className="font-semibold">
                            {strategies.avalanche.monthsToPayoff} meses
                          </p>
                        </div>
                      </div>
                    </button>

                    {/* Snowball */}
                    <button
                      onClick={() => handleSelectStrategy('snowball')}
                      className={`p-4 rounded-lg border text-left transition-all ${
                        selectedStrategy === 'snowball'
                          ? 'border-cyan-500 bg-cyan-500/10 ring-2 ring-cyan-500/30'
                          : 'border-gray-700 hover:border-gray-600 hover:bg-gray-800/50'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-2xl">⛄</span>
                        <div>
                          <h3 className="font-semibold">
                            Método Bola de Nieve
                          </h3>
                          <p className="text-xs text-gray-400">
                            Paga primero la deuda más pequeña
                          </p>
                        </div>
                        <div className="ml-auto flex flex-col items-end gap-1">
                          {selectedStrategy === 'snowball' && (
                            <span className="px-2 py-1 bg-cyan-500/20 text-cyan-400 text-xs rounded font-medium">
                              ✓ Seleccionado
                            </span>
                          )}
                          {strategies.recommendation === 'snowball' && (
                            <span className="px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded">
                              Recomendado
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-gray-400">Interés Total</p>
                          <p className="font-semibold text-orange-400">
                            {formatCurrency(
                              strategies.snowball.totalInterestCents
                            )}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-400">Tiempo</p>
                          <p className="font-semibold">
                            {strategies.snowball.monthsToPayoff} meses
                          </p>
                        </div>
                      </div>
                    </button>
                  </div>

                  {strategies.savingsWithAvalanche > 0 && (
                    <p className="mt-4 text-sm text-center text-green-400">
                      💡 Con avalancha ahorras{' '}
                      {formatCurrency(strategies.savingsWithAvalanche)} en
                      intereses
                    </p>
                  )}
                </div>
              )}

              {/* Debts List */}
              <div className="space-y-4">
                <h2 className="text-lg font-semibold">Tus Deudas</h2>
                {debts.map((debt) => (
                  <div
                    key={debt.id}
                    className="bg-gray-900/50 border border-gray-800 rounded-xl p-6 hover:border-gray-700 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <span className="text-3xl">
                          {DEBT_TYPE_LABELS[debt.type]?.emoji || '📋'}
                        </span>
                        <div>
                          <h3 className="font-semibold text-lg">{debt.name}</h3>
                          <p className="text-sm text-gray-400">
                            {DEBT_TYPE_LABELS[debt.type]?.label}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-1 text-xs rounded ${STATUS_LABELS[debt.status]?.color}`}
                        >
                          {STATUS_LABELS[debt.status]?.label}
                        </span>
                        <button
                          onClick={() => setDeleteConfirm(debt)}
                          className="p-2 text-gray-400 hover:text-red-400 transition-colors"
                          title="Eliminar"
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

                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
                      <div>
                        <p className="text-xs text-gray-400">Saldo Actual</p>
                        <p className="text-xl font-bold text-red-400">
                          {formatCurrency(debt.currentBalanceCents)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400">APR</p>
                        <p className="text-xl font-bold text-orange-400">
                          {debt.aprPercent}%
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400">Pago Mínimo</p>
                        <p className="text-xl font-bold">
                          {debt.minimumPaymentCents
                            ? formatCurrency(debt.minimumPaymentCents)
                            : 'N/A'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400">Fecha Muerte</p>
                        <p className="text-xl font-bold text-green-400">
                          {debt.deathDate || 'Calcular...'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400">
                          Nivel de Peligro
                        </p>
                        <p
                          className={`text-xl font-bold ${getDangerColor(debt.dangerScore)}`}
                        >
                          {debt.dangerScore !== null
                            ? `${debt.dangerScore}/100`
                            : 'N/A'}
                        </p>
                        <p
                          className={`text-xs ${getDangerColor(debt.dangerScore)}`}
                        >
                          {getDangerLabel(debt.dangerScore)}
                        </p>
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div className="mb-4">
                      <div className="flex justify-between text-xs text-gray-400 mb-1">
                        <span>Progreso de pago</span>
                        <span>
                          {Math.round(
                            (1 -
                              debt.currentBalanceCents /
                                debt.originalBalanceCents) *
                              100
                          )}
                          %
                        </span>
                      </div>
                      <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-green-500 to-emerald-400 transition-all"
                          style={{
                            width: `${Math.round((1 - debt.currentBalanceCents / debt.originalBalanceCents) * 100)}%`,
                          }}
                        />
                      </div>
                    </div>

                    {/* Actions */}
                    {debt.status === 'active' && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => setShowPaymentModal(debt)}
                          className="flex-1 py-2 bg-green-600 hover:bg-green-500 rounded-lg text-sm font-medium transition-colors"
                        >
                          Registrar Pago
                        </button>
                        <button
                          onClick={() => {
                            setCalculatorYears(1);
                            setShowCalculator(debt);
                          }}
                          className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 rounded-lg text-sm transition-colors"
                          title="Calculadora de pagos"
                        >
                          🧮 Calculadora
                        </button>
                        <button
                          onClick={() => handleMarkAsPaid(debt)}
                          className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition-colors"
                        >
                          Pagada
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </main>

        {/* Add Debt Modal */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-900 rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-gray-800">
                <h2 className="text-xl font-bold">Agregar Nueva Deuda</h2>
              </div>
              <form onSubmit={handleAddDebt} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">
                    Nombre
                  </label>
                  <input
                    type="text"
                    value={newDebt.name}
                    onChange={(e) =>
                      setNewDebt({ ...newDebt, name: e.target.value })
                    }
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-red-500"
                    placeholder="Ej: Tarjeta BBVA"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-1">
                    Tipo
                  </label>
                  <select
                    value={newDebt.type}
                    onChange={(e) =>
                      setNewDebt({
                        ...newDebt,
                        type: e.target.value as DebtType,
                      })
                    }
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-red-500"
                  >
                    {Object.entries(DEBT_TYPE_LABELS).map(
                      ([key, { label, emoji }]) => (
                        <option key={key} value={key}>
                          {emoji} {label}
                        </option>
                      )
                    )}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">
                      Saldo Original
                    </label>
                    <input
                      type="number"
                      value={newDebt.original_balance_cents || ''}
                      onChange={(e) =>
                        setNewDebt({
                          ...newDebt,
                          original_balance_cents:
                            parseFloat(e.target.value) || 0,
                        })
                      }
                      className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-red-500"
                      placeholder="50000"
                      step="0.01"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">
                      Saldo Actual
                    </label>
                    <input
                      type="number"
                      value={newDebt.current_balance_cents || ''}
                      onChange={(e) =>
                        setNewDebt({
                          ...newDebt,
                          current_balance_cents:
                            parseFloat(e.target.value) || 0,
                        })
                      }
                      className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-red-500"
                      placeholder="35000"
                      step="0.01"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">
                      APR (%)
                    </label>
                    <input
                      type="number"
                      value={newDebt.apr_percent || ''}
                      onChange={(e) =>
                        setNewDebt({
                          ...newDebt,
                          apr_percent: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-red-500"
                      placeholder="28.9"
                      step="0.1"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">
                      Pago Mínimo
                    </label>
                    <input
                      type="number"
                      value={newDebt.minimum_payment_cents || ''}
                      onChange={(e) =>
                        setNewDebt({
                          ...newDebt,
                          minimum_payment_cents:
                            parseFloat(e.target.value) || 0,
                        })
                      }
                      className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-red-500"
                      placeholder="1500"
                      step="0.01"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-1">
                    Día de Corte
                  </label>
                  <input
                    type="number"
                    value={newDebt.due_day}
                    onChange={(e) =>
                      setNewDebt({
                        ...newDebt,
                        due_day: parseInt(e.target.value) || 1,
                      })
                    }
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-red-500"
                    min="1"
                    max="31"
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="flex-1 py-3 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 py-3 bg-red-600 hover:bg-red-500 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {isSubmitting ? 'Guardando...' : 'Agregar Deuda'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Record Payment Modal */}
        {showPaymentModal && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-900 rounded-2xl max-w-md w-full">
              <div className="p-6 border-b border-gray-800">
                <h2 className="text-xl font-bold">Registrar Pago</h2>
                <p className="text-sm text-gray-400">{showPaymentModal.name}</p>
              </div>
              <form onSubmit={handleRecordPayment} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">
                    Monto del Pago
                  </label>
                  <input
                    type="number"
                    value={payment.amount}
                    onChange={(e) =>
                      setPayment({ ...payment, amount: e.target.value })
                    }
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-green-500"
                    placeholder="1500"
                    step="0.01"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-1">
                    Fecha del Pago
                  </label>
                  <input
                    type="date"
                    value={payment.date}
                    onChange={(e) =>
                      setPayment({ ...payment, date: e.target.value })
                    }
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-green-500"
                    required
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowPaymentModal(null)}
                    className="flex-1 py-3 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 py-3 bg-green-600 hover:bg-green-500 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {isSubmitting ? 'Registrando...' : 'Registrar Pago'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Debt Payoff Calculator Modal */}
        {showCalculator && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-900 rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-gray-800">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold flex items-center gap-2">
                      <span>🧮</span> Calculadora de Pagos
                    </h2>
                    <p className="text-sm text-gray-400">
                      {showCalculator.name}
                    </p>
                  </div>
                  <button
                    onClick={() => setShowCalculator(null)}
                    className="p-2 text-gray-400 hover:text-white transition-colors"
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
              </div>

              <div className="p-6 space-y-6">
                {/* Debt Info Summary */}
                <div className="bg-gray-800/50 rounded-xl p-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-400">Saldo Actual</p>
                      <p className="text-xl font-bold text-red-400">
                        {formatCurrency(showCalculator.currentBalanceCents)}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-400">Tasa APR</p>
                      <p className="text-xl font-bold text-orange-400">
                        {showCalculator.aprPercent}%
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-400">Pago Mínimo</p>
                      <p className="text-lg font-semibold">
                        {showCalculator.minimumPaymentCents
                          ? formatCurrency(showCalculator.minimumPaymentCents)
                          : 'No definido'}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-400">Interés Mensual</p>
                      <p className="text-lg font-semibold text-yellow-400">
                        {formatCurrency(
                          Math.round(
                            (showCalculator.currentBalanceCents *
                              (showCalculator.aprPercent / 100)) /
                              12
                          )
                        )}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Time Selection */}
                <div>
                  <label className="block text-sm text-gray-400 mb-3">
                    ¿En cuánto tiempo quieres pagar esta deuda?
                  </label>
                  <div className="grid grid-cols-5 gap-2 mb-3">
                    {[0.5, 1, 2, 3, 5].map((years) => (
                      <button
                        key={years}
                        onClick={() => setCalculatorYears(years)}
                        className={`py-3 rounded-lg text-sm font-medium transition-all ${
                          calculatorYears === years
                            ? 'bg-cyan-600 text-white'
                            : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                        }`}
                      >
                        {years < 1 ? '6m' : `${years}a`}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-gray-400">
                      Personalizado:
                    </span>
                    <div className="flex items-center gap-2 flex-1">
                      <input
                        type="number"
                        min="0.5"
                        max="30"
                        step="0.5"
                        value={calculatorYears}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          if (!isNaN(val) && val >= 0.5 && val <= 30) {
                            setCalculatorYears(val);
                          }
                        }}
                        className="w-20 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-center text-white focus:outline-none focus:border-cyan-500"
                      />
                      <span className="text-gray-400">años</span>
                      <span className="text-gray-500 text-sm">
                        ({Math.round(calculatorYears * 12)} meses)
                      </span>
                    </div>
                  </div>
                </div>

                {/* Results */}
                {(() => {
                  const months = Math.round(calculatorYears * 12);
                  const monthlyPayment = calculateMonthlyPayment(
                    showCalculator.currentBalanceCents,
                    showCalculator.aprPercent,
                    months
                  );
                  const totalInterest = calculateTotalInterest(
                    showCalculator.currentBalanceCents,
                    showCalculator.aprPercent,
                    monthlyPayment,
                    months
                  );
                  const minimumPayment = showCalculator.minimumPaymentCents
                    ? showCalculator.minimumPaymentCents / 100
                    : 0;
                  const extraPayment = Math.max(
                    0,
                    monthlyPayment - minimumPayment
                  );

                  // Calculate if paying only minimum
                  const minPaymentMonths =
                    minimumPayment > 0
                      ? (() => {
                          let balance =
                            showCalculator.currentBalanceCents / 100;
                          const monthlyRate =
                            showCalculator.aprPercent / 100 / 12;
                          let monthCount = 0;
                          while (balance > 0 && monthCount < 600) {
                            balance =
                              balance * (1 + monthlyRate) - minimumPayment;
                            monthCount++;
                          }
                          return monthCount;
                        })()
                      : 0;

                  const minPaymentTotalInterest =
                    minimumPayment > 0 && minPaymentMonths < 600
                      ? minimumPayment * minPaymentMonths -
                        showCalculator.currentBalanceCents / 100
                      : 0;

                  const interestSavings =
                    minPaymentTotalInterest - totalInterest;

                  return (
                    <div className="space-y-4">
                      {/* Main Result */}
                      <div className="bg-gradient-to-br from-cyan-500/20 to-purple-500/20 rounded-xl p-6 border border-cyan-500/30">
                        <p className="text-gray-400 text-sm mb-1">
                          Pago mensual necesario
                        </p>
                        <p className="text-4xl font-bold text-cyan-400">
                          {formatCurrency(Math.round(monthlyPayment * 100))}
                        </p>
                        <p className="text-sm text-gray-400 mt-2">
                          Para liquidar en {months} meses (
                          {calculatorYears < 1
                            ? '6 meses'
                            : `${calculatorYears} año${calculatorYears > 1 ? 's' : ''}`}
                          )
                        </p>
                      </div>

                      {/* Extra Payment Info */}
                      {minimumPayment > 0 && extraPayment > 0 && (
                        <div className="bg-gray-800/50 rounded-xl p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-lg">💪</span>
                            <p className="font-semibold">Pago adicional</p>
                          </div>
                          <p className="text-2xl font-bold text-green-400">
                            +{formatCurrency(Math.round(extraPayment * 100))}
                          </p>
                          <p className="text-sm text-gray-400 mt-1">
                            Adicional al pago mínimo de{' '}
                            {formatCurrency(
                              showCalculator.minimumPaymentCents || 0
                            )}
                          </p>
                        </div>
                      )}

                      {/* Comparison Stats */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-gray-800/50 rounded-xl p-4">
                          <p className="text-gray-400 text-xs mb-1">
                            Interés total a pagar
                          </p>
                          <p className="text-xl font-bold text-orange-400">
                            {formatCurrency(Math.round(totalInterest * 100))}
                          </p>
                        </div>
                        <div className="bg-gray-800/50 rounded-xl p-4">
                          <p className="text-gray-400 text-xs mb-1">
                            Total a pagar
                          </p>
                          <p className="text-xl font-bold">
                            {formatCurrency(
                              Math.round(monthlyPayment * months * 100)
                            )}
                          </p>
                        </div>
                      </div>

                      {/* Savings vs Minimum Payment */}
                      {minimumPayment > 0 &&
                        minPaymentMonths < 600 &&
                        interestSavings > 0 && (
                          <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-lg">🎉</span>
                              <p className="font-semibold text-green-400">
                                ¡Ahorro en intereses!
                              </p>
                            </div>
                            <p className="text-sm text-gray-300">
                              Pagando{' '}
                              {formatCurrency(Math.round(monthlyPayment * 100))}{' '}
                              al mes en vez del mínimo:
                            </p>
                            <ul className="mt-2 space-y-1 text-sm">
                              <li className="flex justify-between">
                                <span className="text-gray-400">
                                  Ahorras en intereses:
                                </span>
                                <span className="font-semibold text-green-400">
                                  {formatCurrency(
                                    Math.round(interestSavings * 100)
                                  )}
                                </span>
                              </li>
                              <li className="flex justify-between">
                                <span className="text-gray-400">
                                  Terminas antes:
                                </span>
                                <span className="font-semibold text-cyan-400">
                                  {minPaymentMonths - months} meses (
                                  {Math.round((minPaymentMonths - months) / 12)}{' '}
                                  años)
                                </span>
                              </li>
                            </ul>
                          </div>
                        )}

                      {/* Warning if minimum payment is too low */}
                      {minimumPayment > 0 && minPaymentMonths >= 600 && (
                        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">⚠️</span>
                            <p className="text-sm text-red-400">
                              Con el pago mínimo, esta deuda tardaría más de 50
                              años en pagarse (interés compuesto)
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>

              <div className="p-6 border-t border-gray-800">
                <button
                  onClick={() => setShowCalculator(null)}
                  className="w-full py-3 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        <ConfirmModal
          isOpen={deleteConfirm !== null}
          onClose={() => setDeleteConfirm(null)}
          onConfirm={handleDeleteDebt}
          title="Eliminar Deuda"
          message={`¿Estás seguro de eliminar "${deleteConfirm?.name}"? Esta acción no se puede deshacer.`}
          confirmText="Eliminar"
          cancelText="Cancelar"
          variant="danger"
          isLoading={isDeleting}
        />
      </div>
    </Sidebar>
  );
}
