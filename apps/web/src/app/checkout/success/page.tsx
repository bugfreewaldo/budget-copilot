'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@budget-copilot/ui/button';

/**
 * Checkout Success Page
 * Shows confirmation after successful payment
 */
export default function CheckoutSuccessPage(): React.ReactElement {
  const router = useRouter();

  // Redirect to dashboard after 5 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      router.push('/dashboard');
    }, 5000);
    return () => clearTimeout(timer);
  }, [router]);

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      {/* Background */}
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-1/4 w-96 h-96 bg-green-500/10 rounded-full blur-3xl" />
        <div className="absolute top-1/3 -right-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl" />
      </div>

      {/* Main Content */}
      <main className="relative z-10 flex-1 flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center">
          {/* Success Icon */}
          <div className="w-20 h-20 mx-auto mb-6 bg-green-500/20 rounded-full flex items-center justify-center">
            <svg
              className="w-10 h-10 text-green-400"
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
          </div>

          <h1 className="text-3xl font-bold mb-4">Pago Exitoso</h1>
          <p className="text-gray-400 text-lg mb-8">
            Tu cuenta ha sido actualizada a Pro. Ahora tienes acceso completo a
            todas las funcionalidades.
          </p>

          <div className="space-y-4">
            <Link href="/dashboard">
              <Button
                size="lg"
                className="w-full bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-600 hover:to-purple-600"
              >
                Ir al Dashboard
              </Button>
            </Link>
            <p className="text-gray-500 text-sm">
              Seras redirigido automaticamente en 5 segundos...
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
