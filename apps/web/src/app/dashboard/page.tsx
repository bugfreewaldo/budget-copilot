'use client';

import { useState } from 'react';
import { Button } from '@budget-copilot/ui/button';
import Link from 'next/link';
import { useDecision } from '@/lib/hooks';
import { acknowledgeDecision, formatCents } from '@/lib/api';
import type { RiskLevel } from '@/lib/api';
import { Sidebar } from '@/components/layout';

// Risk level configuration - small chips, no emojis for paid users
const RISK_CONFIG: Record<
  RiskLevel,
  { label: string; color: string; bgColor: string; borderColor: string }
> = {
  safe: {
    label: 'Bajo',
    color: 'text-green-400',
    bgColor: 'bg-green-500/10',
    borderColor: 'border-green-500/30',
  },
  caution: {
    label: 'Moderado',
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-500/10',
    borderColor: 'border-yellow-500/30',
  },
  warning: {
    label: 'Elevado',
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/30',
  },
  danger: {
    label: 'Alto',
    color: 'text-red-400',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/30',
  },
  critical: {
    label: 'Crítico',
    color: 'text-red-500',
    bgColor: 'bg-red-600/10',
    borderColor: 'border-red-600/30',
  },
};

/**
 * Format a date as "20 ene" style
 */
function formatShortDate(dateStr: string | null): string {
  if (!dateStr) return '-';
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
}

/**
 * Decision Screen - The Core Product
 * BudgetCopilot decides. Not calculates.
 */
export default function DashboardPage(): React.ReactElement {
  const { decision, isLoading, error, forceRefresh } = useDecision();
  const [acknowledging, setAcknowledging] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  // Debug: log decision data
  console.log('[Dashboard] decision:', decision);
  console.log('[Dashboard] suggestions:', decision?.suggestions);

  // Handle action button click - now confirms the decision
  const handleAction = async () => {
    if (!decision || acknowledging || confirmed) return;

    setAcknowledging(true);
    try {
      await acknowledgeDecision(decision.id);
      setConfirmed(true);
    } catch (err) {
      console.error('Failed to acknowledge decision:', err);
    } finally {
      setAcknowledging(false);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <Sidebar>
        <div className="min-h-screen bg-gray-950 flex items-center justify-center">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-400">
              Analizando tu situación financiera...
            </p>
          </div>
        </div>
      </Sidebar>
    );
  }

  // Error state
  if (error || !decision) {
    return (
      <Sidebar>
        <div className="min-h-screen bg-gray-950 flex items-center justify-center">
          <div className="text-center max-w-md mx-auto px-4">
            <div className="text-6xl mb-6">🤖</div>
            <h1 className="text-2xl font-bold text-white mb-3">
              Motor de Decisiones Sin Conexión
            </h1>
            <p className="text-gray-400 mb-6">
              No pudimos calcular tu instrucción. Asegúrate de tener cuentas y
              transacciones configuradas.
            </p>
            <div className="flex gap-3 justify-center">
              <Button
                onClick={() => forceRefresh()}
                className="bg-cyan-600 hover:bg-cyan-700"
              >
                Reintentar
              </Button>
              <Link href="/transacciones">
                <Button variant="outline" className="border-gray-600">
                  Agregar Transacciones
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </Sidebar>
    );
  }

  const riskConfig = RISK_CONFIG[decision.riskLevel];

  // Extract context values for display
  const cashAvailable = decision.context?.cashAvailable ?? 0;
  const upcomingBills = decision.context?.upcomingBillsTotal ?? 0;
  const runwayDays = decision.context?.runwayDays ?? 0;
  const nextBillDate = decision.context?.nextBillDate ?? null;
  const nextBillAmount = decision.context?.nextBillAmount ?? 0;
  const dailyBudget = decision.context?.dailyBudget ?? 0;
  const flexibleBudget = Math.max(0, cashAvailable - upcomingBills);

  // FREE USER: Decision wall (authority, no answers)
  if (!decision.isPaid) {
    return (
      <Sidebar>
        <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center p-6">
          {/* Background effects */}
          <div className="fixed inset-0 z-0 pointer-events-none">
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-red-600/10 rounded-full blur-3xl"></div>
            <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl"></div>
          </div>

          <div className="relative z-10 max-w-md w-full text-center">
            {/* Risk chip - small */}
            <div
              className={`inline-flex items-center gap-2 ${riskConfig.bgColor} ${riskConfig.borderColor} border rounded-full px-4 py-2 mb-8`}
            >
              <span className={`text-sm font-medium ${riskConfig.color}`}>
                Riesgo: {riskConfig.label}
              </span>
            </div>

            {/* The authority headline */}
            <h1 className="text-2xl font-bold text-white mb-6">
              Hoy se requiere una acción financiera.
            </h1>

            {/* Vague warnings - teaser signals without specifics */}
            <div className="space-y-3 mb-8">
              {decision.warnings.map((warning, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 text-amber-400 text-sm justify-center"
                >
                  <span>⚠️</span>
                  <span>{warning}</span>
                </div>
              ))}
              {decision.warnings.length === 0 && (
                <p className="text-gray-400">
                  Tu situación financiera requiere atención.
                </p>
              )}
            </div>

            {/* The authority line - divider */}
            <div className="border-t border-gray-800 my-6"></div>

            {/* Teaser */}
            <div className="mb-8">
              <p className="text-lg text-gray-300">
                Ya hemos determinado el siguiente paso correcto para hoy.
              </p>
            </div>

            {/* Expired decision notice */}
            {decision.hasExpiredDecision && (
              <p className="text-gray-500 text-sm mb-6">
                La recomendación de ayer expiró.
              </p>
            )}

            {/* CTA - Authority copy */}
            <Link href="/pricing">
              <Button
                size="lg"
                className="w-full bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-600 hover:to-purple-600 text-lg py-6"
              >
                Ver exactamente qué hacer
              </Button>
            </Link>
            <p className="text-gray-500 text-xs mt-3">
              Decisión válida solo por hoy.
            </p>
          </div>
        </div>
      </Sidebar>
    );
  }

  // PAID USER: New decision layout
  return (
    <Sidebar>
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-xl">
          {/* ============================================================ */}
          {/* TOP: Status Strip */}
          {/* ============================================================ */}
          <div className="flex flex-wrap items-center justify-center gap-3 mb-6">
            {/* Risk chip */}
            <div
              className={`inline-flex items-center gap-1.5 ${riskConfig.bgColor} ${riskConfig.borderColor} border rounded-full px-3 py-1`}
            >
              <span
                className={`w-2 h-2 rounded-full ${riskConfig.color.replace('text-', 'bg-')}`}
              ></span>
              <span className={`text-xs font-medium ${riskConfig.color}`}>
                Riesgo: {riskConfig.label}
              </span>
            </div>

            {/* Runway chip */}
            <div className="inline-flex items-center gap-1.5 bg-gray-800/50 border border-gray-700/50 rounded-full px-3 py-1">
              <span className="text-xs text-gray-400">Margen:</span>
              <span
                className={`text-xs font-medium ${runwayDays <= 3 ? 'text-red-400' : runwayDays <= 7 ? 'text-amber-400' : 'text-gray-200'}`}
              >
                {runwayDays} días
              </span>
            </div>

            {/* Next bill chip */}
            {nextBillDate && nextBillAmount > 0 && (
              <div className="inline-flex items-center gap-1.5 bg-gray-800/50 border border-gray-700/50 rounded-full px-3 py-1">
                <span className="text-xs text-gray-400">Próximo:</span>
                <span className="text-xs font-medium text-gray-200">
                  {formatCents(nextBillAmount)} el{' '}
                  {formatShortDate(nextBillDate)}
                </span>
              </div>
            )}

            {/* Refresh button */}
            <button
              onClick={() => forceRefresh()}
              className="inline-flex items-center justify-center w-7 h-7 bg-gray-800/50 border border-gray-700/50 rounded-full text-gray-400 hover:text-white hover:bg-gray-700/50 transition-all"
              title="Actualizar datos"
            >
              <svg
                className="w-3.5 h-3.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
            </button>
          </div>

          {/* ============================================================ */}
          {/* MIDDLE: Decision Card */}
          {/* ============================================================ */}
          <div className="bg-gray-900/60 backdrop-blur-sm border border-gray-800 rounded-2xl p-6 sm:p-8 mb-6">
            {/* Title */}
            <p className="text-gray-400 text-sm text-center mb-2">
              Tu gasto flexible recomendado hoy
            </p>

            {/* The big number */}
            <div className="text-center mb-4">
              <span
                className={`text-5xl sm:text-6xl font-bold ${dailyBudget > 0 ? 'text-white' : 'text-gray-400'}`}
              >
                {formatCents(dailyBudget)}
              </span>
            </div>

            {/* Subtext */}
            <p className="text-gray-500 text-sm text-center mb-6">
              {nextBillDate ? (
                <>
                  Este es tu presupuesto flexible hasta el{' '}
                  {formatShortDate(nextBillDate)}.
                </>
              ) : (
                <>Este es tu presupuesto flexible diario.</>
              )}
            </p>

            {/* Soft warning if $0 */}
            {dailyBudget === 0 && (
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 mb-6">
                <p className="text-amber-400 text-sm text-center">
                  Si gastas más, podrías quedarte corto para pagar tus gastos
                  fijos
                  {nextBillDate && <> del {formatShortDate(nextBillDate)}</>}.
                </p>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex flex-col gap-3">
              <Button
                size="lg"
                onClick={handleAction}
                disabled={acknowledging || confirmed}
                className={`w-full py-4 text-base border-0 transition-all ${
                  confirmed
                    ? 'bg-gray-700 cursor-default'
                    : 'bg-cyan-600 hover:bg-cyan-700'
                }`}
              >
                {acknowledging ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Procesando...
                  </span>
                ) : confirmed ? (
                  <span className="flex items-center justify-center gap-2">
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
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    Plan confirmado
                  </span>
                ) : (
                  'Entendido'
                )}
              </Button>
            </div>

            {/* Confirmation message or expiration */}
            <div className="text-center mt-4">
              {confirmed ? (
                <p className="text-gray-500 text-xs">
                  Plan activo hasta que cambien tus finanzas.
                </p>
              ) : (
                <p className="text-gray-600 text-xs">
                  Válido por {decision.hoursRemaining} hora
                  {decision.hoursRemaining !== 1 ? 's' : ''}
                </p>
              )}
            </div>
          </div>

          {/* ============================================================ */}
          {/* BOTTOM: Why (breakdown bullets) */}
          {/* ============================================================ */}
          <div className="bg-gray-900/40 border border-gray-800/50 rounded-xl p-5">
            <p className="text-gray-500 text-xs uppercase tracking-wide mb-3">
              Desglose
            </p>
            <ul className="space-y-2">
              <li className="flex items-center justify-between text-sm">
                <span className="text-gray-400">Efectivo disponible</span>
                <span className="text-white font-medium">
                  {formatCents(cashAvailable)}
                </span>
              </li>
              <li className="flex items-center justify-between text-sm">
                <span className="text-gray-400">
                  Gastos fijos pendientes
                  {nextBillDate && (
                    <span className="text-gray-600">
                      {' '}
                      (hasta {formatShortDate(nextBillDate)})
                    </span>
                  )}
                </span>
                {upcomingBills > 0 ? (
                  <span className="text-red-400 font-medium">
                    −{formatCents(upcomingBills)}
                  </span>
                ) : (
                  <Link
                    href="/advisor"
                    className="text-amber-400 text-xs hover:text-amber-300"
                  >
                    + Agregar gastos fijos
                  </Link>
                )}
              </li>
              <li className="flex items-center justify-between text-sm pt-2 border-t border-gray-800">
                <span className="text-gray-300">Presupuesto flexible</span>
                <span
                  className={`font-bold ${flexibleBudget > 0 ? 'text-cyan-400' : 'text-gray-400'}`}
                >
                  {formatCents(flexibleBudget)}
                </span>
              </li>
            </ul>

            {/* Optional: Suggestion/lever */}
            {decision.suggestions && decision.suggestions.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-800">
                <div className="flex items-start gap-2 text-sm">
                  <span className="text-cyan-400 mt-0.5">💡</span>
                  <p className="text-gray-400">{decision.suggestions[0]}</p>
                </div>
              </div>
            )}
          </div>

          {/* ============================================================ */}
          {/* ADVISOR CTA - Prominent button to talk to financial advisor */}
          {/* ============================================================ */}
          <Link href="/advisor" className="block mt-6">
            <div className="bg-gradient-to-r from-purple-600/20 to-cyan-600/20 border border-purple-500/30 rounded-xl p-4 hover:from-purple-600/30 hover:to-cyan-600/30 transition-all cursor-pointer">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-cyan-500 rounded-full flex items-center justify-center">
                    <svg
                      className="w-5 h-5 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
                      />
                    </svg>
                  </div>
                  <div>
                    <p className="text-white font-medium">
                      Hablar con tu Asesor Financiero
                    </p>
                    <p className="text-gray-400 text-sm">
                      Ajusta datos, importa archivos, o pide consejos
                      personalizados
                    </p>
                  </div>
                </div>
                <svg
                  className="w-5 h-5 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </div>
            </div>
          </Link>

          {/* Expired decision notice */}
          {decision.hasExpiredDecision && (
            <p className="text-gray-600 text-xs text-center mt-4">
              La recomendación de ayer expiró.
            </p>
          )}
        </div>
      </div>
    </Sidebar>
  );
}
