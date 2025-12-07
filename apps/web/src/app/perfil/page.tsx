'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Sidebar } from '@/components/layout/Sidebar';

interface User {
  id: string;
  email: string;
  name: string | null;
  emailVerified: boolean;
  plan: 'free' | 'pro' | 'premium';
  planExpiresAt: number | null;
  createdAt: number;
  lastLoginAt: number | null;
}

const PLAN_INFO = {
  free: {
    name: 'Gratuito',
    color: 'text-gray-400',
    bgColor: 'bg-gray-500/20',
    borderColor: 'border-gray-500/30',
    features: ['Hasta 100 transacciones/mes', '1 cuenta', 'Categorias basicas'],
  },
  pro: {
    name: 'Pro',
    color: 'text-cyan-400',
    bgColor: 'bg-cyan-500/20',
    borderColor: 'border-cyan-500/30',
    features: [
      'Transacciones ilimitadas',
      'Cuentas ilimitadas',
      'AI Copilot',
      'Exportar datos',
    ],
  },
  premium: {
    name: 'Premium',
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/20',
    borderColor: 'border-purple-500/30',
    features: [
      'Todo de Pro',
      'Soporte prioritario',
      'Integraciones bancarias',
      'Reportes avanzados',
    ],
  },
};

export default function PerfilPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    async function loadUser() {
      try {
        const res = await fetch('/api/v1/auth/me');
        if (res.ok) {
          const data = await res.json();
          setUser(data.user);
        } else {
          router.push('/login');
        }
      } catch (error) {
        console.error('Error loading user:', error);
        router.push('/login');
      } finally {
        setIsLoading(false);
      }
    }
    loadUser();
  }, [router]);

  async function handleLogout() {
    setIsLoggingOut(true);
    try {
      await fetch('/api/v1/auth/logout', { method: 'POST' });
      router.push('/login');
    } catch (error) {
      console.error('Error logging out:', error);
      setIsLoggingOut(false);
    }
  }

  function formatDate(timestamp: number): string {
    return new Date(timestamp).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }

  if (isLoading) {
    return (
      <Sidebar>
        <div className="min-h-screen bg-gray-950 flex items-center justify-center">
          <div className="flex items-center gap-3 px-6 py-3 bg-gray-900/50 rounded-xl border border-gray-800">
            <div className="w-5 h-5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-gray-400">Cargando perfil...</p>
          </div>
        </div>
      </Sidebar>
    );
  }

  if (!user) {
    return null;
  }

  const planInfo = PLAN_INFO[user.plan];

  return (
    <Sidebar>
      <div className="min-h-screen bg-gray-950 p-4 lg:p-8">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/dashboard"
            className="text-gray-400 hover:text-white text-sm mb-4 inline-flex items-center gap-1 transition-colors"
          >
            <span>&#8592;</span> Volver al Dashboard
          </Link>
          <h1 className="text-3xl font-bold text-white mb-2">
            <span className="mr-2">&#128100;</span>
            Mi Perfil
          </h1>
          <p className="text-gray-400">
            Administra tu cuenta y configuracion
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* User Info Card */}
          <div className="bg-gray-900/50 rounded-2xl border border-gray-800 p-6">
            <h2 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
              <span>&#128231;</span> Informacion de la Cuenta
            </h2>

            <div className="space-y-4">
              {/* Avatar & Name */}
              <div className="flex items-center gap-4 pb-4 border-b border-gray-800">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-cyan-500 to-purple-500 flex items-center justify-center text-2xl text-white font-bold">
                  {user.name ? user.name.charAt(0).toUpperCase() : user.email.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-white">
                    {user.name || 'Usuario'}
                  </h3>
                  <p className="text-gray-400 text-sm">{user.email}</p>
                </div>
              </div>

              {/* Email Verification */}
              <div className="flex items-center justify-between py-3 border-b border-gray-800">
                <div>
                  <p className="text-gray-400 text-sm">Correo electronico</p>
                  <p className="text-white">{user.email}</p>
                </div>
                {user.emailVerified ? (
                  <span className="px-3 py-1 rounded-full bg-green-500/20 text-green-400 text-sm flex items-center gap-1">
                    <span>&#10003;</span> Verificado
                  </span>
                ) : (
                  <span className="px-3 py-1 rounded-full bg-amber-500/20 text-amber-400 text-sm flex items-center gap-1">
                    <span>&#9888;</span> No verificado
                  </span>
                )}
              </div>

              {/* Account Created */}
              <div className="flex items-center justify-between py-3 border-b border-gray-800">
                <div>
                  <p className="text-gray-400 text-sm">Miembro desde</p>
                  <p className="text-white">{formatDate(user.createdAt)}</p>
                </div>
              </div>

              {/* Last Login */}
              {user.lastLoginAt && (
                <div className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-gray-400 text-sm">Ultimo acceso</p>
                    <p className="text-white">{formatDate(user.lastLoginAt)}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Subscription Card */}
          <div className={`${planInfo.bgColor} rounded-2xl border ${planInfo.borderColor} p-6`}>
            <h2 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
              <span>&#11088;</span> Tu Suscripcion
            </h2>

            <div className="mb-6">
              <div className="flex items-center gap-3 mb-2">
                <span className={`text-3xl font-bold ${planInfo.color}`}>
                  Plan {planInfo.name}
                </span>
              </div>
              {user.planExpiresAt && (
                <p className="text-gray-400 text-sm">
                  Expira: {formatDate(user.planExpiresAt)}
                </p>
              )}
            </div>

            <div className="mb-6">
              <p className="text-gray-400 text-sm mb-3">Incluye:</p>
              <ul className="space-y-2">
                {planInfo.features.map((feature, idx) => (
                  <li key={idx} className="flex items-center gap-2 text-white text-sm">
                    <span className={planInfo.color}>&#10003;</span>
                    {feature}
                  </li>
                ))}
              </ul>
            </div>

            {user.plan === 'free' && (
              <Link
                href="/pricing"
                className="block w-full py-3 bg-gradient-to-r from-cyan-500 to-purple-500 text-white text-center rounded-xl font-medium hover:opacity-90 transition-opacity"
              >
                Mejorar Plan
              </Link>
            )}
          </div>

          {/* Security Card */}
          <div className="bg-gray-900/50 rounded-2xl border border-gray-800 p-6">
            <h2 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
              <span>&#128274;</span> Seguridad
            </h2>

            <div className="space-y-4">
              <Link
                href="/forgot-password"
                className="flex items-center justify-between p-4 bg-gray-800/50 rounded-xl hover:bg-gray-800 transition-colors group"
              >
                <div>
                  <p className="text-white font-medium">Cambiar contrasena</p>
                  <p className="text-gray-400 text-sm">
                    Actualiza tu contrasena de acceso
                  </p>
                </div>
                <span className="text-gray-400 group-hover:text-white transition-colors">
                  &#8594;
                </span>
              </Link>
            </div>
          </div>

          {/* Quick Links Card */}
          <div className="bg-gray-900/50 rounded-2xl border border-gray-800 p-6">
            <h2 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
              <span>&#128279;</span> Enlaces Rapidos
            </h2>

            <div className="space-y-3">
              <Link
                href="/familia"
                className="flex items-center justify-between p-4 bg-gray-800/50 rounded-xl hover:bg-gray-800 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">&#128106;</span>
                  <p className="text-white font-medium">Mi Familia</p>
                </div>
                <span className="text-gray-400 group-hover:text-white transition-colors">
                  &#8594;
                </span>
              </Link>

              <Link
                href="/terms"
                className="flex items-center justify-between p-4 bg-gray-800/50 rounded-xl hover:bg-gray-800 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">&#128220;</span>
                  <p className="text-white font-medium">Terminos de Servicio</p>
                </div>
                <span className="text-gray-400 group-hover:text-white transition-colors">
                  &#8594;
                </span>
              </Link>

              <Link
                href="/privacy"
                className="flex items-center justify-between p-4 bg-gray-800/50 rounded-xl hover:bg-gray-800 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">&#128273;</span>
                  <p className="text-white font-medium">Politica de Privacidad</p>
                </div>
                <span className="text-gray-400 group-hover:text-white transition-colors">
                  &#8594;
                </span>
              </Link>
            </div>
          </div>
        </div>

        {/* Logout Section */}
        <div className="mt-8 pt-8 border-t border-gray-800">
          <button
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="px-6 py-3 bg-red-500/20 text-red-400 border border-red-500/30 rounded-xl font-medium hover:bg-red-500/30 transition-colors disabled:opacity-50"
          >
            {isLoggingOut ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin"></span>
                Cerrando sesion...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <span>&#128682;</span> Cerrar Sesion
              </span>
            )}
          </button>
        </div>
      </div>
    </Sidebar>
  );
}
