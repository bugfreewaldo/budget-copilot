'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';

interface InviteDetails {
  role: string;
  email: string | null;
  expiresAt: number;
  household: {
    id: string;
    name: string;
    memberCount: number;
  };
  invitedBy: {
    name: string | null;
    email: string;
  } | null;
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrador',
  member: 'Miembro',
  viewer: 'Solo lectura',
};

export default function InvitePage() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const router = useRouter();
  const [invite, setInvite] = useState<InviteDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAccepting, setIsAccepting] = useState(false);
  const [needsAuth, setNeedsAuth] = useState(false);

  useEffect(() => {
    async function loadInvite() {
      try {
        const res = await fetch(`/api/v1/households/invite/${token}`);
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error?.message || 'Invalid invite');
        }

        setInvite(data.invite);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'No se pudo cargar la invitación'
        );
      } finally {
        setLoading(false);
      }
    }

    loadInvite();
  }, [token]);

  const handleAccept = async () => {
    setIsAccepting(true);
    setError(null);
    let shouldResetAccepting = true;

    try {
      const res = await fetch(`/api/v1/households/invite/${token}`, {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json();

      if (!res.ok) {
        if (res.status === 401) {
          // Don't reset isAccepting - we're transitioning to a different view
          // This avoids a React DOM reconciliation error from rapid state changes
          shouldResetAccepting = false;
          setNeedsAuth(true);
          return;
        }
        throw new Error(data.error?.message || 'Failed to accept invite');
      }

      // Success! Redirect to family page
      router.push('/familia');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Error al aceptar la invitación'
      );
    } finally {
      if (shouldResetAccepting) {
        setIsAccepting(false);
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error && !invite) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <div className="text-6xl mb-4">❌</div>
          <h1 className="text-2xl font-bold text-white mb-2">
            Invitación Inválida
          </h1>
          <p className="text-gray-400 mb-6">{error}</p>
          <Link
            href="/login"
            className="inline-block px-6 py-3 bg-gradient-to-r from-cyan-500 to-purple-600 text-white rounded-xl font-medium"
          >
            Ir a Iniciar Sesión
          </Link>
        </div>
      </div>
    );
  }

  if (needsAuth) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-gray-900 rounded-2xl p-8 border border-gray-800 text-center">
          <div className="text-6xl mb-4">🔐</div>
          <h1 className="text-2xl font-bold text-white mb-2">
            Inicia Sesión para Continuar
          </h1>
          <p className="text-gray-400 mb-6">
            Necesitas iniciar sesión o crear una cuenta para unirte a{' '}
            <span className="text-white font-medium">
              {invite?.household.name}
            </span>
          </p>
          <div className="space-y-3">
            <Link
              href={`/login?redirect=/invite/${token}`}
              className="block w-full py-3 bg-gradient-to-r from-cyan-500 to-purple-600 text-white rounded-xl font-medium"
            >
              Iniciar Sesión
            </Link>
            <Link
              href={`/register?redirect=/invite/${token}`}
              className="block w-full py-3 bg-gray-800 text-gray-300 rounded-xl font-medium hover:bg-gray-700"
            >
              Crear Cuenta
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-gray-900 rounded-2xl p-8 border border-gray-800">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 mb-4">
            <span className="text-4xl">👨‍👩‍👧‍👦</span>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">
            Invitación a Hogar
          </h1>
          <p className="text-gray-400">Te han invitado a unirte</p>
        </div>

        {/* Household Info */}
        <div className="bg-gray-800/50 rounded-xl p-6 mb-6">
          <h2 className="text-xl font-bold text-white mb-2">
            {invite?.household.name}
          </h2>
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Tu rol:</span>
              <span className="text-cyan-400 font-medium">
                {ROLE_LABELS[invite?.role || ''] || invite?.role}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Miembros actuales:</span>
              <span className="text-white">
                {invite?.household.memberCount}
              </span>
            </div>
            {invite?.invitedBy && (
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Invitado por:</span>
                <span className="text-white">
                  {invite.invitedBy.name || invite.invitedBy.email}
                </span>
              </div>
            )}
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        {/* Actions */}
        <div className="space-y-3">
          <button
            onClick={handleAccept}
            disabled={isAccepting}
            className="w-full py-3 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white rounded-xl font-medium transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isAccepting ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Uniéndose...
              </>
            ) : (
              <>
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
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                Unirme al Hogar
              </>
            )}
          </button>
          <Link
            href="/dashboard"
            className="block w-full py-3 bg-gray-800 text-gray-300 text-center rounded-xl font-medium hover:bg-gray-700"
          >
            Cancelar
          </Link>
        </div>

        {/* Footer */}
        <p className="mt-6 text-center text-xs text-gray-500">
          Esta invitación expira el{' '}
          {invite?.expiresAt
            ? new Date(invite.expiresAt).toLocaleDateString('es-ES')
            : ''}
        </p>
      </div>
    </div>
  );
}
