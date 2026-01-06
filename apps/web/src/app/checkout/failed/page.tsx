'use client';

import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@budget-copilot/ui/button';
import { Suspense } from 'react';

function FailedContent() {
  const searchParams = useSearchParams();
  const reason = searchParams.get('reason') || 'unknown';

  const getErrorMessage = (reason: string): string => {
    switch (reason) {
      case 'payment_rejected':
        return 'El pago fue rechazado por tu banco o tarjeta.';
      case 'processing_error':
        return 'Hubo un error al procesar el pago.';
      case 'cancelled':
        return 'El pago fue cancelado.';
      default:
        return 'No se pudo completar el pago.';
    }
  };

  return (
    <div className="max-w-md w-full text-center">
      {/* Error Icon */}
      <div className="w-20 h-20 mx-auto mb-6 bg-red-500/20 rounded-full flex items-center justify-center">
        <svg
          className="w-10 h-10 text-red-400"
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
      </div>

      <h1 className="text-3xl font-bold mb-4">Pago No Completado</h1>
      <p className="text-gray-400 text-lg mb-8">{getErrorMessage(reason)}</p>

      <div className="space-y-4">
        <Link href="/pricing">
          <Button
            size="lg"
            className="w-full bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-600 hover:to-purple-600"
          >
            Intentar de Nuevo
          </Button>
        </Link>
        <Link href="/dashboard">
          <Button variant="outline" size="lg" className="w-full">
            Volver al Dashboard
          </Button>
        </Link>
      </div>

      <p className="text-gray-500 text-sm mt-8">
        Si el problema persiste, contacta a soporte.
      </p>
    </div>
  );
}

/**
 * Checkout Failed Page
 * Shows error message after failed payment
 */
export default function CheckoutFailedPage(): React.ReactElement {
  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      {/* Background */}
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-1/4 w-96 h-96 bg-red-500/10 rounded-full blur-3xl" />
        <div className="absolute top-1/3 -right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
      </div>

      {/* Main Content */}
      <main className="relative z-10 flex-1 flex items-center justify-center p-6">
        <Suspense
          fallback={
            <div className="text-center">
              <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto" />
            </div>
          }
        >
          <FailedContent />
        </Suspense>
      </main>
    </div>
  );
}
