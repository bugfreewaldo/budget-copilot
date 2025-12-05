'use client';

import { useState, useEffect, useCallback } from 'react';
import { Sidebar } from '@/components/layout';
import {
  getCategories,
  getEnvelopes,
  getCurrentMonth,
  formatCents,
  type Category,
  type Envelope,
} from '@/lib/api';

// Format month for display
function formatMonth(month: string): string {
  const [year, monthNum] = month.split('-');
  const months = [
    'Enero',
    'Febrero',
    'Marzo',
    'Abril',
    'Mayo',
    'Junio',
    'Julio',
    'Agosto',
    'Septiembre',
    'Octubre',
    'Noviembre',
    'Diciembre',
  ];
  return `${months[parseInt(monthNum!) - 1]} ${year}`;
}

// Navigate to next/prev month
function getAdjacentMonth(month: string, direction: 'prev' | 'next'): string {
  const [year, monthNum] = month.split('-').map(Number);
  let newYear = year!;
  let newMonth = monthNum! + (direction === 'next' ? 1 : -1);

  if (newMonth > 12) {
    newMonth = 1;
    newYear++;
  } else if (newMonth < 1) {
    newMonth = 12;
    newYear--;
  }

  return `${newYear}-${String(newMonth).padStart(2, '0')}`;
}

// Get progress bar color based on percentage
function getProgressColor(percent: number): string {
  if (percent >= 100) return 'bg-red-500';
  if (percent >= 80) return 'bg-yellow-500';
  return 'bg-emerald-500';
}

export default function PresupuestoPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [envelopes, setEnvelopes] = useState<Envelope[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingEnvelope, setEditingEnvelope] = useState<Envelope | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [budgetAmount, setBudgetAmount] = useState('');

  // Load data
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [categoriesData, envelopesData] = await Promise.all([
        getCategories(),
        getEnvelopes(selectedMonth),
      ]);
      setCategories(categoriesData);
      setEnvelopes(envelopesData);
    } catch (err) {
      console.error('Failed to load data:', err);
      setError('Error al cargar los datos. ¿Está el servidor corriendo?');
    } finally {
      setLoading(false);
    }
  }, [selectedMonth]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Get categories without envelopes for this month
  const categoriesWithoutEnvelopes = categories.filter(
    (cat) => !envelopes.find((env) => env.categoryId === cat.id)
  );

  // Create or update envelope
  const handleSaveEnvelope = async () => {
    if (!selectedCategoryId || !budgetAmount) return;

    setSaving(true);
    try {
      const budgetCents = Math.round(parseFloat(budgetAmount) * 100);

      const response = await fetch('/api/v1/envelopes', {
        method: 'POST', // API handles upsert based on categoryId + month
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          categoryId: editingEnvelope?.categoryId || selectedCategoryId,
          month: selectedMonth,
          budgetCents,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save envelope');
      }

      await loadData();
      setShowCreateModal(false);
      setEditingEnvelope(null);
      setSelectedCategoryId('');
      setBudgetAmount('');
    } catch (err) {
      console.error('Failed to save envelope:', err);
      alert('Error al guardar el sobre. Intenta de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  // Delete envelope
  const handleDeleteEnvelope = async (id: string) => {
    if (!confirm('¿Seguro que quieres eliminar este sobre?')) return;

    try {
      const response = await fetch(`/api/v1/envelopes/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete envelope');
      }

      await loadData();
    } catch (err) {
      console.error('Failed to delete envelope:', err);
      alert('Error al eliminar el sobre.');
    }
  };

  // Open edit modal
  const openEditModal = (envelope: Envelope) => {
    setEditingEnvelope(envelope);
    setSelectedCategoryId(envelope.categoryId);
    setBudgetAmount((envelope.budgetCents / 100).toString());
    setShowCreateModal(true);
  };

  // Calculate totals
  const totalBudget = envelopes.reduce((sum, e) => sum + e.budgetCents, 0);
  const totalSpent = envelopes.reduce((sum, e) => sum + e.spentCents, 0);
  const totalRemaining = totalBudget - totalSpent;
  const overallPercent = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;

  return (
    <Sidebar>
      <div className="min-h-screen bg-gray-950">
        {/* Animated Background */}
        <div className="fixed inset-0 z-0 pointer-events-none">
          <div className="absolute top-0 -left-40 w-96 h-96 bg-emerald-600 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-blob"></div>
          <div className="absolute top-0 -right-40 w-96 h-96 bg-blue-600 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-blob animation-delay-2000"></div>
          <div className="absolute -bottom-40 left-40 w-96 h-96 bg-cyan-600 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-blob animation-delay-4000"></div>
        </div>

        <main className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 py-6 lg:py-8">
          {/* Header */}
          <div className="mb-6 lg:mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl lg:text-3xl font-bold text-white mb-1 lg:mb-2 flex items-center gap-3">
                <span className="text-4xl">📊</span> Presupuesto
              </h1>
              <p className="text-sm lg:text-base text-gray-400">
                Administra tus sobres de presupuesto por categoría
              </p>
            </div>
            <button
              onClick={() => {
                setEditingEnvelope(null);
                setSelectedCategoryId('');
                setBudgetAmount('');
                setShowCreateModal(true);
              }}
              disabled={categoriesWithoutEnvelopes.length === 0}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 text-white rounded-xl font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span>+</span> Nuevo Sobre
            </button>
          </div>

          {/* Month Navigation */}
          <div className="flex items-center justify-center gap-4 mb-6 lg:mb-8">
            <button
              onClick={() => setSelectedMonth(getAdjacentMonth(selectedMonth, 'prev'))}
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-all"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div className="px-6 py-2 bg-gray-900/50 rounded-xl border border-gray-800">
              <span className="text-lg font-semibold text-white">
                {formatMonth(selectedMonth)}
              </span>
            </div>
            <button
              onClick={() => setSelectedMonth(getAdjacentMonth(selectedMonth, 'next'))}
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-all"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {/* Error State */}
          {error && (
            <div className="mb-6 p-4 bg-red-900/30 border border-red-500/50 rounded-lg">
              <p className="text-red-400">{error}</p>
            </div>
          )}

          {/* Loading State */}
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-flex items-center gap-3 px-6 py-3 bg-gray-900/50 rounded-xl border border-gray-800">
                <div className="w-5 h-5 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-gray-400">Cargando presupuesto...</p>
              </div>
            </div>
          ) : (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 lg:mb-8">
                <div className="bg-gray-900/50 backdrop-blur-xl rounded-2xl border border-gray-800 p-5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-gray-400 text-sm">Presupuesto Total</span>
                    <span className="text-2xl">💰</span>
                  </div>
                  <div className="text-2xl font-bold text-white">
                    {formatCents(totalBudget)}
                  </div>
                </div>
                <div className="bg-gray-900/50 backdrop-blur-xl rounded-2xl border border-gray-800 p-5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-gray-400 text-sm">Gastado</span>
                    <span className="text-2xl">🔥</span>
                  </div>
                  <div className="text-2xl font-bold text-red-400">
                    {formatCents(totalSpent)}
                  </div>
                </div>
                <div className="bg-gray-900/50 backdrop-blur-xl rounded-2xl border border-gray-800 p-5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-gray-400 text-sm">Disponible</span>
                    <span className="text-2xl">✨</span>
                  </div>
                  <div
                    className={`text-2xl font-bold ${totalRemaining >= 0 ? 'text-emerald-400' : 'text-red-400'}`}
                  >
                    {formatCents(totalRemaining)}
                  </div>
                </div>
              </div>

              {/* Overall Progress */}
              {totalBudget > 0 && (
                <div className="bg-gray-900/50 backdrop-blur-xl rounded-2xl border border-gray-800 p-5 mb-6 lg:mb-8">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-white font-medium">Progreso General</span>
                    <span
                      className={`font-bold ${overallPercent >= 100 ? 'text-red-400' : overallPercent >= 80 ? 'text-yellow-400' : 'text-emerald-400'}`}
                    >
                      {overallPercent.toFixed(0)}%
                    </span>
                  </div>
                  <div className="h-3 bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${getProgressColor(overallPercent)} transition-all duration-500`}
                      style={{ width: `${Math.min(overallPercent, 100)}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Envelopes List */}
              {envelopes.length === 0 ? (
                <div className="text-center py-16">
                  <div className="text-8xl mb-6">📊</div>
                  <h2 className="text-2xl font-bold text-white mb-3">
                    No hay sobres para este mes
                  </h2>
                  <p className="text-gray-400 mb-6 max-w-md mx-auto">
                    Crea sobres de presupuesto para cada categoría y controla tus
                    gastos mes a mes.
                  </p>
                  {categoriesWithoutEnvelopes.length > 0 ? (
                    <button
                      onClick={() => setShowCreateModal(true)}
                      className="px-6 py-3 bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 text-white rounded-xl font-medium transition-all text-lg"
                    >
                      📊 Crear Mi Primer Sobre
                    </button>
                  ) : (
                    <p className="text-yellow-400">
                      Primero crea categorías en la sección de Categorías.
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
                    Sobres del Mes
                  </h3>
                  {envelopes.map((envelope) => {
                    const category = categories.find((c) => c.id === envelope.categoryId);
                    const percent =
                      envelope.budgetCents > 0
                        ? (envelope.spentCents / envelope.budgetCents) * 100
                        : 0;
                    const remaining = envelope.budgetCents - envelope.spentCents;

                    return (
                      <div
                        key={envelope.id}
                        className="bg-gray-900/50 backdrop-blur-xl rounded-2xl border border-gray-800 p-5 hover:border-gray-700 transition-all"
                      >
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <span className="text-3xl">{category?.emoji || '📁'}</span>
                            <div>
                              <h4 className="text-lg font-semibold text-white">
                                {category?.name || 'Sin categoría'}
                              </h4>
                              <p className="text-sm text-gray-500">
                                {formatCents(envelope.spentCents)} gastado de{' '}
                                {formatCents(envelope.budgetCents)}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => openEditModal(envelope)}
                              className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-all"
                              title="Editar"
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
                              onClick={() => handleDeleteEnvelope(envelope.id)}
                              className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
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

                        {/* Progress Bar */}
                        <div className="mb-3">
                          <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                            <div
                              className={`h-full ${getProgressColor(percent)} transition-all duration-500`}
                              style={{ width: `${Math.min(percent, 100)}%` }}
                            />
                          </div>
                        </div>

                        {/* Stats */}
                        <div className="flex items-center justify-between text-sm">
                          <span
                            className={`font-medium ${percent >= 100 ? 'text-red-400' : percent >= 80 ? 'text-yellow-400' : 'text-emerald-400'}`}
                          >
                            {percent.toFixed(0)}% usado
                          </span>
                          <span
                            className={`font-medium ${remaining >= 0 ? 'text-gray-400' : 'text-red-400'}`}
                          >
                            {remaining >= 0
                              ? `${formatCents(remaining)} disponible`
                              : `${formatCents(Math.abs(remaining))} sobre el límite`}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </main>

        {/* Create/Edit Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setShowCreateModal(false)}
            />
            <div className="relative bg-gray-900 rounded-2xl border border-gray-800 p-6 w-full max-w-md">
              <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <span>📊</span>{' '}
                {editingEnvelope ? 'Editar Sobre' : 'Nuevo Sobre de Presupuesto'}
              </h3>

              <div className="space-y-4">
                {!editingEnvelope && (
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">
                      Categoría
                    </label>
                    <select
                      value={selectedCategoryId}
                      onChange={(e) => setSelectedCategoryId(e.target.value)}
                      className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white focus:outline-none focus:border-emerald-500"
                    >
                      <option value="">Selecciona una categoría</option>
                      {categoriesWithoutEnvelopes.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.emoji} {cat.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {editingEnvelope && (
                  <div className="flex items-center gap-3 p-3 bg-gray-800/50 rounded-xl">
                    <span className="text-2xl">
                      {categories.find((c) => c.id === editingEnvelope.categoryId)
                        ?.emoji || '📁'}
                    </span>
                    <span className="text-white font-medium">
                      {categories.find((c) => c.id === editingEnvelope.categoryId)
                        ?.name || 'Sin categoría'}
                    </span>
                  </div>
                )}

                <div>
                  <label className="block text-sm text-gray-400 mb-1">
                    Presupuesto Mensual
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                      $
                    </span>
                    <input
                      type="number"
                      value={budgetAmount}
                      onChange={(e) => setBudgetAmount(e.target.value)}
                      placeholder="0.00"
                      className="w-full pl-8 pr-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 text-xl font-bold"
                    />
                  </div>
                </div>

                {/* Quick amounts */}
                <div>
                  <label className="block text-sm text-gray-400 mb-2">
                    Montos sugeridos
                  </label>
                  <div className="flex gap-2 flex-wrap">
                    {[500, 1000, 2000, 3000, 5000].map((amount) => (
                      <button
                        key={amount}
                        onClick={() => setBudgetAmount(amount.toString())}
                        className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-white rounded-lg text-sm transition-all"
                      >
                        ${amount.toLocaleString()}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    setEditingEnvelope(null);
                  }}
                  className="flex-1 py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-xl font-medium transition-all"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveEnvelope}
                  disabled={
                    saving ||
                    (!editingEnvelope && !selectedCategoryId) ||
                    !budgetAmount
                  }
                  className="flex-1 py-3 bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 text-white rounded-xl font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {saving ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <span>💾</span>{' '}
                      {editingEnvelope ? 'Guardar Cambios' : 'Crear Sobre'}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Sidebar>
  );
}
