'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@budget-copilot/ui/button';
import { initiateCheckout, getCurrentUser, type User } from '@/lib/api';
import { useToast } from '@/components/ui/toast';

/**
 * Pricing Page - Simple, Decision-Focused
 * Annual is default. Cancel anytime.
 */
export default function PricingPage(): React.ReactElement {
  const router = useRouter();
  const { showToast } = useToast();
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>(
    'yearly'
  );
  const [isLoading, setIsLoading] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  // Check authentication status
  useEffect(() => {
    getCurrentUser()
      .then((result) => {
        if (result?.user) {
          setUser(result.user);
        }
      })
      .catch(() => {
        // Not logged in, that's fine
      });
  }, []);

  const prices = {
    monthly: { amount: 4.99, originalAmount: 9.99, period: '/mes' },
    yearly: {
      amount: 39.99,
      monthlyEquiv: 3.33,
      originalMonthlyEquiv: 6.67,
      period: '/ano',
    },
  };

  const handleCheckout = async () => {
    setIsLoading(true);
    try {
      const result = await initiateCheckout(billingPeriod);
      // Redirect to Tilopay payment page
      window.location.href = result.paymentUrl;
    } catch (error) {
      console.error('Checkout error:', error);
      // If not authenticated, redirect to login
      if (error instanceof Error && error.message.includes('authenticated')) {
        showToast('Inicia sesion para continuar', 'info');
        router.push('/login?redirect=/pricing');
      } else {
        showToast('Error al iniciar el pago. Intenta de nuevo.', 'error');
      }
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      {/* Background */}
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
        <div className="absolute top-1/3 -right-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <header className="relative z-10 border-b border-gray-800/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <span className="text-2xl">🧠</span>
              <span className="text-xl font-bold bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
                Budget Copilot
              </span>
            </Link>
            {user ? (
              <Link
                href="/dashboard"
                className="text-gray-400 hover:text-white text-sm"
              >
                Volver al Dashboard
              </Link>
            ) : (
              <Link
                href="/login"
                className="text-gray-400 hover:text-white text-sm"
              >
                Iniciar Sesion
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 flex-1 flex items-center justify-center p-6">
        <div className="max-w-lg w-full text-center">
          {/* Value Proposition */}
          <h1 className="text-3xl md:text-4xl font-bold mb-4">
            Sabe exactamente que hacer con tu dinero
          </h1>
          <p className="text-gray-400 text-lg mb-8">
            Un comando diario. Sin graficas. Sin confusion.
          </p>

          {/* Comparison */}
          <div className="grid grid-cols-2 gap-4 mb-8 text-left">
            <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4">
              <p className="text-gray-500 text-sm mb-2">Gratis</p>
              <p className="text-white">Ve que algo necesita atencion</p>
            </div>
            <div className="bg-gradient-to-br from-cyan-900/30 to-purple-900/30 border border-cyan-500/50 rounded-xl p-4">
              <p className="text-cyan-400 text-sm mb-2">Pro</p>
              <p className="text-white font-medium">
                Sabe exactamente que hacer
              </p>
            </div>
          </div>

          {/* Billing Toggle */}
          <div className="flex justify-center mb-6">
            <div className="inline-flex bg-gray-800/50 rounded-full p-1">
              <button
                onClick={() => setBillingPeriod('monthly')}
                className={`px-4 py-2 rounded-full text-sm transition-all ${
                  billingPeriod === 'monthly'
                    ? 'bg-white text-gray-900'
                    : 'text-gray-400'
                }`}
              >
                Mensual
              </button>
              <button
                onClick={() => setBillingPeriod('yearly')}
                className={`px-4 py-2 rounded-full text-sm transition-all flex items-center gap-2 ${
                  billingPeriod === 'yearly'
                    ? 'bg-white text-gray-900'
                    : 'text-gray-400'
                }`}
              >
                Anual
                <span className="bg-green-500 text-white text-xs px-2 py-0.5 rounded-full">
                  -33%
                </span>
              </button>
            </div>
          </div>

          {/* Launch Offer Badge */}
          <div className="inline-flex items-center gap-2 bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/50 rounded-full px-4 py-1.5 mb-4">
            <span className="text-amber-400 text-sm font-medium">
              Oferta de Lanzamiento
            </span>
            <span className="bg-amber-500 text-black text-xs font-bold px-2 py-0.5 rounded-full">
              -50%
            </span>
          </div>

          {/* Price */}
          <div className="mb-8">
            {billingPeriod === 'yearly' ? (
              <>
                <div className="flex items-center justify-center gap-3">
                  <span className="text-2xl text-gray-500 line-through">
                    ${prices.yearly.originalMonthlyEquiv}
                  </span>
                  <div className="text-5xl font-bold">
                    ${prices.yearly.monthlyEquiv}
                    <span className="text-xl text-gray-400">/mes</span>
                  </div>
                </div>
                <p className="text-gray-500 text-sm mt-2">
                  ${prices.yearly.amount} cobrado anualmente
                </p>
              </>
            ) : (
              <>
                <div className="flex items-center justify-center gap-3">
                  <span className="text-2xl text-gray-500 line-through">
                    ${prices.monthly.originalAmount}
                  </span>
                  <div className="text-5xl font-bold">
                    ${prices.monthly.amount}
                    <span className="text-xl text-gray-400">/mes</span>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* CTA */}
          <Button
            size="lg"
            onClick={handleCheckout}
            disabled={isLoading}
            className="w-full bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-600 hover:to-purple-600 text-lg py-6 mb-4 disabled:opacity-50"
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Procesando...
              </span>
            ) : (
              'Obtener Pro'
            )}
          </Button>

          {/* Trust signals */}
          <p className="text-gray-500 text-sm">
            Cancela cuando quieras. Garantia de 14 dias.
          </p>

          {/* Features */}
          <div className="mt-10 text-left">
            <p className="text-gray-400 text-sm mb-4">Con Pro obtienes:</p>
            <ul className="space-y-3">
              {[
                'Decisiones diarias personalizadas',
                'Comandos con consecuencias claras',
                'Estrategias de pago de deudas',
                'Alertas de gastos criticos',
                'Proyeccion de fecha libre de deudas',
                'Contexto "Por que?" bajo demanda',
              ].map((feature, i) => (
                <li key={i} className="flex items-center gap-3 text-sm">
                  <span className="text-cyan-400">✓</span>
                  <span className="text-gray-300">{feature}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-gray-800 py-4">
        <div className="flex justify-center gap-6 text-sm text-gray-500">
          <Link href="/terms" className="hover:text-gray-300">
            Terminos
          </Link>
          <Link href="/privacy" className="hover:text-gray-300">
            Privacidad
          </Link>
          <Link href="/dashboard" className="hover:text-gray-300">
            Volver
          </Link>
        </div>
      </footer>
    </div>
  );
}
