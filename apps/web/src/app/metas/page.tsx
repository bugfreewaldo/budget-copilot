'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useGoals } from '@/lib/hooks';
import {
  createGoal,
  updateGoal,
  deleteGoal,
  contributeToGoal,
  type Goal,
  type GoalType,
  type GoalStatus,
} from '@/lib/api';
import { Sidebar } from '@/components/layout';
import { ConfirmModal } from '@/components/ui/ConfirmModal';

const GOAL_TYPE_LABELS: Record<GoalType, { label: string; emoji: string }> = {
  savings: { label: 'Ahorro', emoji: '💰' },
  debt_payoff: { label: 'Pago de Deuda', emoji: '💳' },
  purchase: { label: 'Compra', emoji: '🛍️' },
  emergency_fund: { label: 'Fondo de Emergencia', emoji: '🆘' },
  investment: { label: 'Inversión', emoji: '📈' },
  other: { label: 'Otro', emoji: '🎯' },
};

const STATUS_LABELS: Record<GoalStatus, { label: string; color: string }> = {
  active: { label: 'Activa', color: 'bg-blue-500/20 text-blue-400' },
  completed: { label: 'Completada', color: 'bg-green-500/20 text-green-400' },
  paused: { label: 'Pausada', color: 'bg-yellow-500/20 text-yellow-400' },
  abandoned: { label: 'Abandonada', color: 'bg-gray-500/20 text-gray-400' },
};

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function getProgressColor(percent: number, onTrack: boolean): string {
  if (!onTrack) return 'from-red-500 to-orange-500';
  if (percent >= 75) return 'from-green-500 to-emerald-400';
  if (percent >= 50) return 'from-cyan-500 to-blue-400';
  if (percent >= 25) return 'from-blue-500 to-indigo-400';
  return 'from-purple-500 to-pink-400';
}

function getDaysRemaining(targetDate: string | null): string {
  if (!targetDate) return 'Sin fecha límite';
  const target = new Date(targetDate);
  const now = new Date();
  const diff = Math.ceil(
    (target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  );
  if (diff < 0) return 'Vencida';
  if (diff === 0) return 'Hoy';
  if (diff === 1) return 'Mañana';
  if (diff < 30) return `${diff} días`;
  if (diff < 365) return `${Math.floor(diff / 30)} meses`;
  return `${Math.floor(diff / 365)} años`;
}

export default function MetasPage() {
  const { goals, summary, isLoading, error, refresh } = useGoals();
  const [showAddModal, setShowAddModal] = useState(false);
  const [showContributeModal, setShowContributeModal] = useState<Goal | null>(
    null
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<Goal | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [filter, setFilter] = useState<GoalStatus | 'all'>('all');

  // Form state for new goal
  const [newGoal, setNewGoal] = useState({
    name: '',
    description: '',
    emoji: '',
    target_amount_cents: 0,
    current_amount_cents: 0,
    target_date: '',
    goal_type: 'savings' as GoalType,
  });

  // Form state for contribution
  const [contribution, setContribution] = useState({
    amount: '',
  });

  const handleAddGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await createGoal({
        name: newGoal.name,
        description: newGoal.description || undefined,
        emoji: newGoal.emoji || undefined,
        target_amount_cents: Math.round(newGoal.target_amount_cents * 100),
        current_amount_cents: Math.round(newGoal.current_amount_cents * 100),
        target_date: newGoal.target_date || undefined,
        goal_type: newGoal.goal_type,
      });
      setShowAddModal(false);
      setNewGoal({
        name: '',
        description: '',
        emoji: '',
        target_amount_cents: 0,
        current_amount_cents: 0,
        target_date: '',
        goal_type: 'savings',
      });
      refresh();
    } catch (err) {
      console.error('Failed to add goal:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleContribute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showContributeModal) return;

    setIsSubmitting(true);
    try {
      await contributeToGoal(
        showContributeModal.id,
        Math.round(parseFloat(contribution.amount) * 100)
      );
      setShowContributeModal(null);
      setContribution({ amount: '' });
      refresh();
    } catch (err) {
      console.error('Failed to contribute:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteGoal = async () => {
    if (!deleteConfirm) return;
    setIsDeleting(true);
    try {
      await deleteGoal(deleteConfirm.id);
      setDeleteConfirm(null);
      refresh();
    } catch (err) {
      console.error('Failed to delete goal:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleStatusChange = async (goal: Goal, status: GoalStatus) => {
    try {
      await updateGoal(goal.id, { status });
      refresh();
    } catch (err) {
      console.error('Failed to update goal status:', err);
    }
  };

  const filteredGoals =
    filter === 'all' ? goals : goals.filter((g) => g.status === filter);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cyan-500" />
      </div>
    );
  }

  if (error) {
    // Check if it's a network/API error - show user-friendly message
    const isNetworkError =
      error.message?.includes('fetch') || error.message?.includes('network');

    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center p-4">
        <div className="text-6xl mb-6">🎯</div>
        <h2 className="text-2xl font-bold text-white mb-2">
          {isNetworkError ? 'API no disponible' : 'Error al cargar'}
        </h2>
        <p className="text-gray-400 text-center max-w-md mb-6">
          {isNetworkError
            ? 'El servidor no está disponible. Intenta recargar la página.'
            : 'Hubo un problema al cargar las metas. Intenta recargar la página.'}
        </p>
        <div className="flex gap-4">
          <button
            onClick={() => refresh()}
            className="px-6 py-3 bg-cyan-600 hover:bg-cyan-500 rounded-lg transition-colors"
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
              <h1 className="text-2xl lg:text-3xl font-bold bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent flex items-center gap-2">
                <span>🎯</span> Seguimiento de Metas
              </h1>
              <p className="text-sm lg:text-base text-gray-400">
                Visualiza tu progreso hacia tus sueños
              </p>
            </div>
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 rounded-xl text-sm lg:text-base font-medium transition-colors"
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
              Nueva Meta
            </button>
          </div>
        </div>

        <main className="max-w-6xl mx-auto px-4 sm:px-6 pb-8">
          {goals.length === 0 ? (
            /* Empty State */
            <div className="flex flex-col items-center justify-center py-20">
              <div className="text-8xl mb-6">🎯</div>
              <h2 className="text-2xl font-bold mb-2">
                ¡Empieza a soñar en grande!
              </h2>
              <p className="text-gray-400 text-center max-w-md mb-8">
                Define tus metas financieras y rastrea tu progreso. Ya sea
                ahorrar para un viaje, un carro, o tu fondo de emergencia.
              </p>
              <div className="flex gap-4">
                <button
                  onClick={() => setShowAddModal(true)}
                  className="px-6 py-3 bg-cyan-600 hover:bg-cyan-500 rounded-lg transition-colors"
                >
                  Crear mi primera meta
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
                  <p className="text-gray-400 text-sm mb-1">Metas Activas</p>
                  <p className="text-3xl font-bold text-cyan-400">
                    {summary?.activeCount ?? 0}
                  </p>
                </div>
                <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
                  <p className="text-gray-400 text-sm mb-1">Meta Total</p>
                  <p className="text-3xl font-bold text-purple-400">
                    {summary ? formatCurrency(summary.totalTargetCents) : '$0'}
                  </p>
                </div>
                <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
                  <p className="text-gray-400 text-sm mb-1">Ahorrado</p>
                  <p className="text-3xl font-bold text-green-400">
                    {summary ? formatCurrency(summary.totalCurrentCents) : '$0'}
                  </p>
                </div>
                <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
                  <p className="text-gray-400 text-sm mb-1">Progreso General</p>
                  <div className="flex items-baseline gap-2">
                    <p className="text-3xl font-bold text-cyan-400">
                      {summary ? Math.round(summary.overallProgressPercent) : 0}
                      %
                    </p>
                    <p className="text-sm text-gray-400">
                      ({summary?.onTrackCount ?? 0} en camino)
                    </p>
                  </div>
                </div>
              </div>

              {/* Filters */}
              <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
                {(
                  ['all', 'active', 'completed', 'paused', 'abandoned'] as const
                ).map((status) => (
                  <button
                    key={status}
                    onClick={() => setFilter(status)}
                    className={`px-4 py-2 rounded-lg text-sm whitespace-nowrap transition-colors ${
                      filter === status
                        ? 'bg-cyan-600 text-white'
                        : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                    }`}
                  >
                    {status === 'all' ? 'Todas' : STATUS_LABELS[status].label}
                  </button>
                ))}
              </div>

              {/* Goals Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredGoals.map((goal) => (
                  <div
                    key={goal.id}
                    className="bg-gray-900/50 border border-gray-800 rounded-2xl overflow-hidden hover:border-gray-700 transition-colors"
                  >
                    {/* Header with emoji and progress ring */}
                    <div
                      className={`relative h-32 bg-gradient-to-br ${getProgressColor(goal.progressPercent, goal.onTrack)} p-6`}
                    >
                      <div className="absolute inset-0 bg-black/30" />
                      <div className="relative flex items-start justify-between">
                        <span className="text-5xl">
                          {goal.emoji ||
                            GOAL_TYPE_LABELS[goal.goalType]?.emoji ||
                            '🎯'}
                        </span>
                        <span
                          className={`px-2 py-1 text-xs rounded ${STATUS_LABELS[goal.status]?.color} backdrop-blur-sm`}
                        >
                          {STATUS_LABELS[goal.status]?.label}
                        </span>
                      </div>
                      <div className="absolute bottom-4 right-4 text-right">
                        <p className="text-3xl font-bold text-white">
                          {Math.round(goal.progressPercent)}%
                        </p>
                        <p className="text-xs text-white/70">completado</p>
                      </div>
                    </div>

                    {/* Content */}
                    <div className="p-6">
                      <h3 className="font-semibold text-lg mb-1">
                        {goal.name}
                      </h3>
                      <p className="text-sm text-gray-400 mb-4">
                        {GOAL_TYPE_LABELS[goal.goalType]?.label}
                      </p>

                      {goal.description && (
                        <p className="text-sm text-gray-500 mb-4 line-clamp-2">
                          {goal.description}
                        </p>
                      )}

                      {/* Progress bar */}
                      <div className="mb-4">
                        <div className="flex justify-between text-sm mb-2">
                          <span className="text-green-400">
                            {formatCurrency(goal.currentAmountCents)}
                          </span>
                          <span className="text-gray-400">
                            {formatCurrency(goal.targetAmountCents)}
                          </span>
                        </div>
                        <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full bg-gradient-to-r ${getProgressColor(goal.progressPercent, goal.onTrack)} transition-all duration-500`}
                            style={{
                              width: `${Math.min(goal.progressPercent, 100)}%`,
                            }}
                          />
                        </div>
                      </div>

                      {/* Meta info */}
                      <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                        <div>
                          <p className="text-gray-500">Tiempo restante</p>
                          <p
                            className={`font-medium ${goal.targetDate && new Date(goal.targetDate) < new Date() ? 'text-red-400' : 'text-white'}`}
                          >
                            {getDaysRemaining(goal.targetDate)}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-500">
                            Aporte mensual sugerido
                          </p>
                          <p className="font-medium text-cyan-400">
                            {goal.recommendedMonthlyCents
                              ? formatCurrency(goal.recommendedMonthlyCents)
                              : 'N/A'}
                          </p>
                        </div>
                      </div>

                      {/* Status indicator */}
                      {goal.status === 'active' && (
                        <div
                          className={`flex items-center gap-2 text-sm mb-4 ${goal.onTrack ? 'text-green-400' : 'text-orange-400'}`}
                        >
                          <span className="relative flex h-2 w-2">
                            <span
                              className={`animate-ping absolute inline-flex h-full w-full rounded-full ${goal.onTrack ? 'bg-green-400' : 'bg-orange-400'} opacity-75`}
                            ></span>
                            <span
                              className={`relative inline-flex rounded-full h-2 w-2 ${goal.onTrack ? 'bg-green-500' : 'bg-orange-500'}`}
                            ></span>
                          </span>
                          {goal.onTrack ? 'En camino' : 'Necesitas acelerar'}
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex gap-2">
                        {goal.status === 'active' && (
                          <button
                            onClick={() => setShowContributeModal(goal)}
                            className="flex-1 py-2 bg-cyan-600 hover:bg-cyan-500 rounded-lg text-sm font-medium transition-colors"
                          >
                            Aportar
                          </button>
                        )}
                        <div className="relative group">
                          <button className="px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors">
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
                                d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
                              />
                            </svg>
                          </button>
                          <div className="absolute right-0 bottom-full mb-2 hidden group-hover:block">
                            <div className="bg-gray-800 rounded-lg shadow-lg py-2 min-w-[140px]">
                              {goal.status === 'active' && (
                                <button
                                  onClick={() =>
                                    handleStatusChange(goal, 'paused')
                                  }
                                  className="w-full px-4 py-2 text-left text-sm hover:bg-gray-700"
                                >
                                  Pausar
                                </button>
                              )}
                              {goal.status === 'paused' && (
                                <button
                                  onClick={() =>
                                    handleStatusChange(goal, 'active')
                                  }
                                  className="w-full px-4 py-2 text-left text-sm hover:bg-gray-700"
                                >
                                  Reanudar
                                </button>
                              )}
                              {goal.status !== 'completed' && (
                                <button
                                  onClick={() =>
                                    handleStatusChange(goal, 'completed')
                                  }
                                  className="w-full px-4 py-2 text-left text-sm hover:bg-gray-700 text-green-400"
                                >
                                  Marcar completada
                                </button>
                              )}
                              <button
                                onClick={() => setDeleteConfirm(goal)}
                                className="w-full px-4 py-2 text-left text-sm hover:bg-gray-700 text-red-400"
                              >
                                Eliminar
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </main>

        {/* Add Goal Modal */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-900 rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-gray-800">
                <h2 className="text-xl font-bold">Nueva Meta</h2>
                <p className="text-sm text-gray-400">
                  Define tu próximo objetivo financiero
                </p>
              </div>
              <form onSubmit={handleAddGoal} className="p-6 space-y-4">
                <div className="grid grid-cols-4 gap-4">
                  <div className="col-span-3">
                    <label className="block text-sm text-gray-400 mb-1">
                      Nombre
                    </label>
                    <input
                      type="text"
                      value={newGoal.name}
                      onChange={(e) =>
                        setNewGoal({ ...newGoal, name: e.target.value })
                      }
                      className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-cyan-500"
                      placeholder="Ej: Viaje a Europa"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">
                      Emoji
                    </label>
                    <input
                      type="text"
                      value={newGoal.emoji}
                      onChange={(e) =>
                        setNewGoal({ ...newGoal, emoji: e.target.value })
                      }
                      className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-cyan-500 text-center text-2xl"
                      placeholder="✈️"
                      maxLength={2}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-1">
                    Descripción (opcional)
                  </label>
                  <textarea
                    value={newGoal.description}
                    onChange={(e) =>
                      setNewGoal({ ...newGoal, description: e.target.value })
                    }
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-cyan-500 resize-none"
                    placeholder="¿Para qué es esta meta?"
                    rows={2}
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-1">
                    Tipo de Meta
                  </label>
                  <select
                    value={newGoal.goal_type}
                    onChange={(e) =>
                      setNewGoal({
                        ...newGoal,
                        goal_type: e.target.value as GoalType,
                      })
                    }
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-cyan-500"
                  >
                    {Object.entries(GOAL_TYPE_LABELS).map(
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
                      Monto Meta
                    </label>
                    <input
                      type="number"
                      value={newGoal.target_amount_cents || ''}
                      onChange={(e) =>
                        setNewGoal({
                          ...newGoal,
                          target_amount_cents: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-cyan-500"
                      placeholder="50000"
                      step="0.01"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">
                      Monto Actual
                    </label>
                    <input
                      type="number"
                      value={newGoal.current_amount_cents || ''}
                      onChange={(e) =>
                        setNewGoal({
                          ...newGoal,
                          current_amount_cents: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-cyan-500"
                      placeholder="0"
                      step="0.01"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-1">
                    Fecha Límite (opcional)
                  </label>
                  <input
                    type="date"
                    value={newGoal.target_date}
                    onChange={(e) =>
                      setNewGoal({ ...newGoal, target_date: e.target.value })
                    }
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-cyan-500"
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
                    className="flex-1 py-3 bg-cyan-600 hover:bg-cyan-500 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {isSubmitting ? 'Guardando...' : 'Crear Meta'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        <ConfirmModal
          isOpen={deleteConfirm !== null}
          onClose={() => setDeleteConfirm(null)}
          onConfirm={handleDeleteGoal}
          title="Eliminar Meta"
          message={`¿Estás seguro de eliminar "${deleteConfirm?.name}"? Esta acción no se puede deshacer.`}
          confirmText="Eliminar"
          cancelText="Cancelar"
          variant="danger"
          isLoading={isDeleting}
        />

        {/* Contribute Modal */}
        {showContributeModal && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-900 rounded-2xl max-w-md w-full">
              <div className="p-6 border-b border-gray-800">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">
                    {showContributeModal.emoji ||
                      GOAL_TYPE_LABELS[showContributeModal.goalType]?.emoji}
                  </span>
                  <div>
                    <h2 className="text-xl font-bold">Aportar a Meta</h2>
                    <p className="text-sm text-gray-400">
                      {showContributeModal.name}
                    </p>
                  </div>
                </div>
              </div>
              <form onSubmit={handleContribute} className="p-6 space-y-4">
                <div className="bg-gray-800/50 rounded-lg p-4 mb-4">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-400">Progreso actual</span>
                    <span className="text-white">
                      {Math.round(showContributeModal.progressPercent)}%
                    </span>
                  </div>
                  <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full bg-gradient-to-r ${getProgressColor(showContributeModal.progressPercent, showContributeModal.onTrack)}`}
                      style={{
                        width: `${Math.min(showContributeModal.progressPercent, 100)}%`,
                      }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-gray-500 mt-2">
                    <span>
                      {formatCurrency(showContributeModal.currentAmountCents)}
                    </span>
                    <span>
                      {formatCurrency(showContributeModal.targetAmountCents)}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-1">
                    Monto a Aportar
                  </label>
                  <input
                    type="number"
                    value={contribution.amount}
                    onChange={(e) =>
                      setContribution({ amount: e.target.value })
                    }
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-cyan-500 text-2xl text-center"
                    placeholder="1000"
                    step="0.01"
                    required
                    autoFocus
                  />
                </div>

                <p className="text-center text-sm text-gray-400">
                  Nuevo total:{' '}
                  {formatCurrency(
                    showContributeModal.currentAmountCents +
                      (parseFloat(contribution.amount) || 0) * 100
                  )}
                </p>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowContributeModal(null)}
                    className="flex-1 py-3 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 py-3 bg-cyan-600 hover:bg-cyan-500 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {isSubmitting ? 'Aportando...' : 'Aportar'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </Sidebar>
  );
}
