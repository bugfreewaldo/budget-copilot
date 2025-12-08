'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function PendingVerificationPage() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [resending, setResending] = useState(false);
  const [resendMessage, setResendMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch('/api/v1/auth/me', { credentials: 'include' });
        if (!res.ok) {
          router.push('/login');
          return;
        }
        const data = await res.json();
        if (data.user.emailVerified) {
          router.push('/dashboard');
          return;
        }
        setEmail(data.user.email);
      } catch {
        router.push('/login');
      } finally {
        setLoading(false);
      }
    };
    checkAuth();
  }, [router]);

  const handleResend = async () => {
    setResending(true);
    setResendMessage(null);
    try {
      const res = await fetch('/api/v1/auth/resend-verification', {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json();
      if (res.ok) {
        setResendMessage({
          type: 'success',
          text: 'Se ha enviado un nuevo correo de verificación.',
        });
      } else {
        setResendMessage({
          type: 'error',
          text: data.message || 'Error al enviar el correo.',
        });
      }
    } catch {
      setResendMessage({
        type: 'error',
        text: 'Error al enviar el correo. Por favor intenta de nuevo.',
      });
    } finally {
      setResending(false);
    }
  };

  const handleLogout = async () => {
    await fetch('/api/v1/auth/logout', { method: 'POST', credentials: 'include' });
    router.push('/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-400"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Animated background blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-1/4 w-96 h-96 bg-cyan-500/20 rounded-full blur-3xl animate-blob" />
        <div className="absolute top-1/3 -right-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl animate-blob animation-delay-2000" />
        <div className="absolute -bottom-1/4 left-1/3 w-96 h-96 bg-pink-500/20 rounded-full blur-3xl animate-blob animation-delay-4000" />
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <Link href="/" className="flex justify-center items-center gap-2 mb-6">
          <span className="text-4xl">🧠</span>
          <span className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
            Budget Copilot
          </span>
        </Link>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="bg-gray-900/80 backdrop-blur-xl py-8 px-4 shadow-2xl border border-gray-800 sm:rounded-2xl sm:px-10">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-amber-500/20 mb-6">
              <svg
                className="h-10 w-10 text-amber-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-white mb-3">
              Verifica tu correo
            </h2>
            <p className="text-gray-400 mb-2">
              Hemos enviado un correo de verificación a:
            </p>
            <p className="text-cyan-400 font-medium mb-6">{email}</p>
            <p className="text-gray-400 text-sm mb-8">
              Por favor revisa tu bandeja de entrada (y carpeta de spam) y haz
              clic en el enlace de verificación para acceder a tu cuenta.
            </p>

            {resendMessage && (
              <div
                className={`mb-6 p-4 rounded-xl text-sm ${
                  resendMessage.type === 'success'
                    ? 'bg-green-500/10 border border-green-500/50 text-green-400'
                    : 'bg-red-500/10 border border-red-500/50 text-red-400'
                }`}
              >
                {resendMessage.text}
              </div>
            )}

            <div className="space-y-4">
              <button
                onClick={handleResend}
                disabled={resending}
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-600 hover:to-purple-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {resending ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                        fill="none"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Enviando...
                  </span>
                ) : (
                  'Reenviar correo de verificación'
                )}
              </button>

              <button
                onClick={handleLogout}
                className="w-full py-3 px-4 border border-gray-700 rounded-xl text-sm font-medium text-gray-300 hover:bg-gray-800 hover:border-gray-600 transition-all"
              >
                Cerrar sesión
              </button>
            </div>

            <p className="mt-6 text-xs text-gray-500">
              Si no recibiste el correo, verifica que{' '}
              <span className="text-gray-400">{email}</span> sea correcto.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
