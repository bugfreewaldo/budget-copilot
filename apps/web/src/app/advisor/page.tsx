'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@budget-copilot/ui/button';
import { Sidebar } from '@/components/layout';
import { AdvisorChat } from '@/components/advisor/AdvisorChat';
import { getAdvisorSession, type AdvisorSessionResponse } from '@/lib/api';

/**
 * Asesor Financiero Page
 *
 * Paid-only consultation interface for updating financial data.
 * Decisions command. Advisor listens.
 */
export default function AdvisorPage() {
  const router = useRouter();
  const [session, setSession] = useState<AdvisorSessionResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getAdvisorSession()
      .then(setSession)
      .catch((err) => {
        console.error('Failed to load advisor session:', err);
        setError('Error al cargar el asesor');
      })
      .finally(() => setIsLoading(false));
  }, []);

  // Loading state
  if (isLoading) {
    return (
      <Sidebar>
        <div className="min-h-screen bg-gray-950 flex items-center justify-center">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-400">Cargando...</p>
          </div>
        </div>
      </Sidebar>
    );
  }

  // Error state
  if (error) {
    return (
      <Sidebar>
        <div className="min-h-screen bg-gray-950 flex items-center justify-center">
          <div className="text-center">
            <p className="text-red-400 mb-4">{error}</p>
            <Button onClick={() => window.location.reload()}>Reintentar</Button>
          </div>
        </div>
      </Sidebar>
    );
  }

  // Paywall for free users
  if (!session?.isPaid) {
    return (
      <Sidebar>
        <div className="min-h-screen bg-gray-950 flex items-center justify-center p-6">
          <div className="max-w-md text-center">
            {/* Lock Icon */}
            <div className="text-6xl mb-6">🔒</div>

            {/* Title */}
            <h1 className="text-2xl font-bold text-white mb-4 flex items-center justify-center gap-2">
              <span>🧠</span> Asesor Financiero
            </h1>

            {/* Paywall message */}
            <p className="text-gray-400 mb-8 leading-relaxed">
              {session?.paywall?.message ||
                'Para consultar o subir documentos, necesitas Pro. Esto permite que BudgetCopilot ajuste tus decisiones con información real.'}
            </p>

            {/* CTA */}
            <Link href={session?.paywall?.ctaUrl || '/pricing'}>
              <Button
                size="lg"
                className="w-full bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-600 hover:to-purple-600"
              >
                {session?.paywall?.ctaText || 'Desbloquear asesor financiero'}
              </Button>
            </Link>

            {/* Back link */}
            <Link
              href="/dashboard"
              className="block mt-6 text-gray-500 hover:text-gray-400 text-sm"
            >
              Volver al dashboard
            </Link>
          </div>
        </div>
      </Sidebar>
    );
  }

  // Advisor chat for paid users
  return (
    <Sidebar>
      <div className="min-h-screen bg-gray-950">
        <div className="max-w-3xl mx-auto p-6">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <span>🧠</span> Asesor Financiero
            </h1>
            {session.welcomeMessage && (
              <p className="text-gray-400 mt-3 leading-relaxed">
                {session.welcomeMessage}
              </p>
            )}
          </div>

          {/* Chat Interface */}
          <AdvisorChat
            sessionId={session.session!.id}
            initialHistory={session.session?.conversationHistory || []}
            initialPendingChanges={session.session?.pendingChanges || null}
            onDecisionUpdated={() => router.push('/dashboard')}
          />
        </div>
      </div>
    </Sidebar>
  );
}
