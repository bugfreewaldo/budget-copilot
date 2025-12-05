'use client';

import { useState, useEffect, useCallback } from 'react';
import { Sidebar } from '@/components/layout';

interface Household {
  id: string;
  name: string;
  inviteCode: string | null;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  joinedAt: number;
}

interface Member {
  id: string;
  userId: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  invitedAt: number;
  acceptedAt: number | null;
  user: {
    name: string | null;
    email: string;
    avatarUrl: string | null;
  };
}

interface Invite {
  id: string;
  url: string;
  email: string | null;
  role: string;
  expiresAt: number;
}

const ROLE_LABELS: Record<string, { label: string; color: string }> = {
  owner: { label: 'Propietario', color: 'bg-purple-500/20 text-purple-400' },
  admin: { label: 'Administrador', color: 'bg-cyan-500/20 text-cyan-400' },
  member: { label: 'Miembro', color: 'bg-green-500/20 text-green-400' },
  viewer: { label: 'Solo lectura', color: 'bg-gray-500/20 text-gray-400' },
};

export default function FamiliaPage() {
  const [households, setHouseholds] = useState<Household[]>([]);
  const [selectedHousehold, setSelectedHousehold] = useState<Household | null>(
    null
  );
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [newHouseholdName, setNewHouseholdName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'member' | 'viewer'>(
    'member'
  );
  const [generatedInvite, setGeneratedInvite] = useState<Invite | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  // Load households
  const loadHouseholds = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/households');
      if (!res.ok) throw new Error('Failed to load households');
      const data = await res.json();
      setHouseholds(data.households || []);

      // Select first household if none selected
      if (data.households?.length > 0 && !selectedHousehold) {
        setSelectedHousehold(data.households[0]);
      }
    } catch (err) {
      console.error('Failed to load households:', err);
      setError('No se pudieron cargar los hogares');
    } finally {
      setLoading(false);
    }
  }, [selectedHousehold]);

  // Load members for selected household
  const loadMembers = useCallback(async () => {
    if (!selectedHousehold) return;

    try {
      const res = await fetch(
        `/api/v1/households/${selectedHousehold.id}/members`
      );
      if (!res.ok) throw new Error('Failed to load members');
      const data = await res.json();
      setMembers(data.members || []);
    } catch (err) {
      console.error('Failed to load members:', err);
    }
  }, [selectedHousehold]);

  useEffect(() => {
    loadHouseholds();
  }, [loadHouseholds]);

  useEffect(() => {
    if (selectedHousehold) {
      loadMembers();
    }
  }, [selectedHousehold, loadMembers]);

  // Create household
  const handleCreateHousehold = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHouseholdName.trim()) return;

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/v1/households', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newHouseholdName.trim() }),
      });

      if (!res.ok) throw new Error('Failed to create household');

      const data = await res.json();
      setShowCreateModal(false);
      setNewHouseholdName('');
      await loadHouseholds();
      setSelectedHousehold(data.household);
    } catch (err) {
      console.error('Failed to create household:', err);
      setError('Error al crear el hogar');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Generate invite
  const handleGenerateInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedHousehold) return;

    setIsSubmitting(true);
    try {
      const res = await fetch(
        `/api/v1/households/${selectedHousehold.id}/invite`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: inviteEmail || undefined,
            role: inviteRole,
          }),
        }
      );

      if (!res.ok) throw new Error('Failed to generate invite');

      const data = await res.json();
      setGeneratedInvite(data.invite);
    } catch (err) {
      console.error('Failed to generate invite:', err);
      setError('Error al generar la invitación');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Copy invite link
  const handleCopyLink = async () => {
    if (!generatedInvite) return;

    try {
      await navigator.clipboard.writeText(generatedInvite.url);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Format date
  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <Sidebar>
        <div className="min-h-screen bg-gray-950 p-6 flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </Sidebar>
    );
  }

  return (
    <Sidebar>
      <div className="min-h-screen bg-gray-950 p-6">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                <span className="text-4xl">👨‍👩‍👧‍👦</span>
                Mi Familia
              </h1>
              <p className="text-gray-400 mt-2">
                Comparte tus finanzas con tu familia
              </p>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-600 hover:to-purple-700 text-white rounded-xl font-medium transition-all flex items-center gap-2"
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
              Crear Hogar
            </button>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
              <p className="text-red-400">{error}</p>
            </div>
          )}

          {households.length === 0 ? (
            <div className="bg-gray-900 rounded-2xl p-12 text-center border border-gray-800">
              <div className="text-6xl mb-4">🏠</div>
              <h2 className="text-xl font-semibold text-white mb-2">
                No tienes un hogar todavía
              </h2>
              <p className="text-gray-400 mb-6">
                Crea un hogar para invitar a tu familia a compartir las finanzas
              </p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-purple-600 text-white rounded-xl font-medium"
              >
                Crear Mi Primer Hogar
              </button>
            </div>
          ) : (
            <div className="grid gap-6">
              {/* Household selector if multiple */}
              {households.length > 1 && (
                <div className="flex gap-2 flex-wrap">
                  {households.map((h) => (
                    <button
                      key={h.id}
                      onClick={() => setSelectedHousehold(h)}
                      className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                        selectedHousehold?.id === h.id
                          ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/50'
                          : 'bg-gray-800 text-gray-400 border border-gray-700 hover:bg-gray-700'
                      }`}
                    >
                      {h.name}
                    </button>
                  ))}
                </div>
              )}

              {selectedHousehold && (
                <>
                  {/* Household Info Card */}
                  <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
                    <div className="flex items-start justify-between">
                      <div>
                        <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                          <span className="text-3xl">🏠</span>
                          {selectedHousehold.name}
                        </h2>
                        <div className="flex items-center gap-3 mt-2">
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-medium ${ROLE_LABELS[selectedHousehold.role]?.color}`}
                          >
                            {ROLE_LABELS[selectedHousehold.role]?.label}
                          </span>
                          <span className="text-gray-500 text-sm">
                            {members.length} miembro
                            {members.length !== 1 ? 's' : ''}
                          </span>
                        </div>
                      </div>
                      {(selectedHousehold.role === 'owner' ||
                        selectedHousehold.role === 'admin') && (
                        <button
                          onClick={() => {
                            setShowInviteModal(true);
                            setGeneratedInvite(null);
                          }}
                          className="px-4 py-2 bg-green-500/10 hover:bg-green-500/20 text-green-400 rounded-xl font-medium transition-all flex items-center gap-2"
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
                              d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
                            />
                          </svg>
                          Invitar
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Members List */}
                  <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
                    <h3 className="text-lg font-semibold text-white mb-4">
                      Miembros
                    </h3>
                    <div className="space-y-3">
                      {members.map((member) => (
                        <div
                          key={member.id}
                          className="flex items-center justify-between p-4 bg-gray-800/50 rounded-xl"
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg">
                              {member.user.name?.[0]?.toUpperCase() ||
                                member.user.email[0]?.toUpperCase()}
                            </div>
                            <div>
                              <p className="font-medium text-white">
                                {member.user.name || member.user.email}
                              </p>
                              {member.user.name && (
                                <p className="text-sm text-gray-400">
                                  {member.user.email}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <span
                              className={`px-3 py-1 rounded-full text-xs font-medium ${ROLE_LABELS[member.role]?.color}`}
                            >
                              {ROLE_LABELS[member.role]?.label}
                            </span>
                            <span className="text-xs text-gray-500">
                              Desde{' '}
                              {formatDate(
                                member.acceptedAt || member.invitedAt
                              )}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Create Household Modal */}
          {showCreateModal && (
            <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
              <div className="bg-gray-900 rounded-2xl max-w-md w-full">
                <div className="p-6 border-b border-gray-800">
                  <h2 className="text-xl font-semibold text-white">
                    Crear Nuevo Hogar
                  </h2>
                </div>
                <form
                  onSubmit={handleCreateHousehold}
                  className="p-6 space-y-4"
                >
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Nombre del Hogar
                    </label>
                    <input
                      type="text"
                      value={newHouseholdName}
                      onChange={(e) => setNewHouseholdName(e.target.value)}
                      placeholder="Ej: Familia García"
                      className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                      required
                    />
                  </div>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setShowCreateModal(false)}
                      className="flex-1 py-3 bg-gray-800 text-gray-300 rounded-xl font-medium hover:bg-gray-700"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting || !newHouseholdName.trim()}
                      className="flex-1 py-3 bg-gradient-to-r from-cyan-500 to-purple-600 text-white rounded-xl font-medium disabled:opacity-50"
                    >
                      {isSubmitting ? 'Creando...' : 'Crear Hogar'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Invite Modal */}
          {showInviteModal && (
            <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
              <div className="bg-gray-900 rounded-2xl max-w-md w-full">
                <div className="p-6 border-b border-gray-800">
                  <h2 className="text-xl font-semibold text-white">
                    Invitar a {selectedHousehold?.name}
                  </h2>
                </div>

                {!generatedInvite ? (
                  <form
                    onSubmit={handleGenerateInvite}
                    className="p-6 space-y-4"
                  >
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Correo electrónico (opcional)
                      </label>
                      <input
                        type="email"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        placeholder="familiar@email.com"
                        className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                      />
                      <p className="mt-1 text-xs text-gray-500">
                        Si lo dejas vacío, cualquiera con el enlace puede unirse
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Rol
                      </label>
                      <select
                        value={inviteRole}
                        onChange={(e) =>
                          setInviteRole(
                            e.target.value as 'admin' | 'member' | 'viewer'
                          )
                        }
                        className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                      >
                        <option value="member">Miembro (puede editar)</option>
                        <option value="admin">Administrador</option>
                        <option value="viewer">Solo lectura</option>
                      </select>
                    </div>

                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => setShowInviteModal(false)}
                        className="flex-1 py-3 bg-gray-800 text-gray-300 rounded-xl font-medium hover:bg-gray-700"
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="flex-1 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-medium disabled:opacity-50"
                      >
                        {isSubmitting ? 'Generando...' : 'Generar Enlace'}
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="p-6 space-y-4">
                    <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-xl">
                      <p className="text-green-400 text-sm mb-2">
                        ¡Enlace de invitación creado!
                      </p>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={generatedInvite.url}
                          readOnly
                          className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm"
                        />
                        <button
                          onClick={handleCopyLink}
                          className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                            copySuccess
                              ? 'bg-green-500 text-white'
                              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                          }`}
                        >
                          {copySuccess ? '¡Copiado!' : 'Copiar'}
                        </button>
                      </div>
                    </div>

                    <p className="text-sm text-gray-400">
                      Este enlace expira el{' '}
                      {formatDate(generatedInvite.expiresAt)}
                    </p>

                    <button
                      onClick={() => {
                        setShowInviteModal(false);
                        setGeneratedInvite(null);
                        setInviteEmail('');
                      }}
                      className="w-full py-3 bg-gray-800 text-gray-300 rounded-xl font-medium hover:bg-gray-700"
                    >
                      Cerrar
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </Sidebar>
  );
}
