'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface AdminStats {
  users: {
    total: number;
    active: number;
    suspended: number;
    newToday: number;
    newThisWeek: number;
    newThisMonth: number;
    byPlan: {
      free: number;
      pro: number;
      premium: number;
    };
    admins: number;
  };
  transactions: {
    total: number;
    recentWeek: number;
  };
  accounts: {
    total: number;
  };
  debts: {
    total: number;
    active: number;
  };
  goals: {
    total: number;
    active: number;
  };
  sessions: {
    active: number;
  };
  files: {
    total: number;
    processed: number;
  };
}

interface User {
  id: string;
  email: string;
  name: string | null;
  status: 'active' | 'suspended' | 'deleted';
  role: 'user' | 'admin' | 'superadmin';
  plan: 'free' | 'pro' | 'premium';
  createdAt: number;
  lastLoginAt: number | null;
}

function UserRow({
  user,
  onEdit,
  onStatusChange,
  onDelete,
}: {
  user: User;
  onEdit: (user: User) => void;
  onStatusChange: (userId: string, status: string) => void;
  onDelete: (user: User) => void;
}) {
  const statusColors = {
    active: 'bg-green-100 text-green-800',
    suspended: 'bg-yellow-100 text-yellow-800',
    deleted: 'bg-red-100 text-red-800',
  };

  const roleColors = {
    user: 'bg-gray-100 text-gray-800',
    admin: 'bg-blue-100 text-blue-800',
    superadmin: 'bg-purple-100 text-purple-800',
  };

  const planColors = {
    free: 'bg-gray-100 text-gray-600',
    pro: 'bg-blue-100 text-blue-700',
    premium: 'bg-amber-100 text-amber-800',
  };

  return (
    <tr className="border-b border-gray-100 hover:bg-gray-50">
      <td className="py-3 px-4">
        <div>
          <p className="font-medium text-gray-900">{user.name || 'Sin nombre'}</p>
          <p className="text-sm text-gray-500">{user.email}</p>
        </div>
      </td>
      <td className="py-3 px-4">
        <span
          className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[user.status]}`}
        >
          {user.status}
        </span>
      </td>
      <td className="py-3 px-4">
        <span
          className={`px-2 py-1 rounded-full text-xs font-medium ${roleColors[user.role]}`}
        >
          {user.role}
        </span>
      </td>
      <td className="py-3 px-4">
        <span
          className={`px-2 py-1 rounded-full text-xs font-medium ${planColors[user.plan]}`}
        >
          {user.plan}
        </span>
      </td>
      <td className="py-3 px-4 text-sm text-gray-500">
        {new Date(user.createdAt).toLocaleDateString()}
      </td>
      <td className="py-3 px-4 text-sm text-gray-500">
        {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString() : 'Nunca'}
      </td>
      <td className="py-3 px-4">
        <div className="flex gap-2">
          <button
            onClick={() => onEdit(user)}
            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
          >
            Editar
          </button>
          {user.status === 'active' && (
            <button
              onClick={() => onStatusChange(user.id, 'suspended')}
              className="text-yellow-600 hover:text-yellow-800 text-sm"
            >
              Suspender
            </button>
          )}
          {user.status === 'suspended' && (
            <button
              onClick={() => onStatusChange(user.id, 'active')}
              className="text-green-600 hover:text-green-800 text-sm"
            >
              Activar
            </button>
          )}
          {user.role !== 'superadmin' && (
            <button
              onClick={() => onDelete(user)}
              className="text-red-600 hover:text-red-800 text-sm"
            >
              Eliminar
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

function EditUserModal({
  user,
  onClose,
  onSave,
}: {
  user: User;
  onClose: () => void;
  onSave: (userId: string, updates: Partial<User>) => Promise<void>;
}) {
  const [name, setName] = useState(user.name || '');
  const [status, setStatus] = useState(user.status);
  const [role, setRole] = useState(user.role);
  const [plan, setPlan] = useState(user.plan);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(user.id, { name, status, role, plan });
      onClose();
    } catch {
      alert('Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Editar Usuario</h3>
        <p className="text-sm text-blue-600 mb-4">{user.email}</p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as User['status'])}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white"
            >
              <option value="active">Activo</option>
              <option value="suspended">Suspendido</option>
              <option value="deleted">Eliminado</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Rol</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as User['role'])}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white"
            >
              <option value="user">Usuario</option>
              <option value="admin">Admin</option>
              <option value="superadmin">Superadmin</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Plan</label>
            <select
              value={plan}
              onChange={(e) => setPlan(e.target.value as User['plan'])}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white"
            >
              <option value="free">Free</option>
              <option value="pro">Pro</option>
              <option value="premium">Premium</option>
            </select>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-900"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ConfirmDeleteModal({
  user,
  onClose,
  onConfirm,
}: {
  user: User;
  onClose: () => void;
  onConfirm: (userId: string) => Promise<void>;
}) {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await onConfirm(user.id);
      onClose();
    } catch {
      alert('Error al eliminar usuario');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h3 className="text-lg font-semibold text-red-600 mb-2">Desactivar Usuario</h3>
        <p className="text-gray-600 mb-4">
          Esta accion cambiara el estado del usuario{' '}
          <strong>{user.email}</strong> a &quot;eliminado&quot;. El usuario no podra
          acceder a su cuenta.
        </p>

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-6">
          <p className="text-sm text-amber-700">
            Los datos del usuario se conservan y pueden restaurarse cambiando su estado desde el panel de edicion.
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            disabled={deleting}
          >
            Cancelar
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
          >
            {deleting ? 'Desactivando...' : 'Desactivar Usuario'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminPage() {
  const router = useRouter();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [planFilter, setPlanFilter] = useState('');
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deletingUser, setDeletingUser] = useState<User | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/admin/stats', { credentials: 'include' });
      if (res.status === 403) {
        router.push('/dashboard');
        return;
      }
      if (!res.ok) throw new Error('Failed to fetch stats');
      const data = await res.json();
      setStats(data.data);
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  }, [router]);

  const fetchUsers = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (search) params.set('q', search);
      if (statusFilter) params.set('status', statusFilter);
      if (roleFilter) params.set('role', roleFilter);
      if (planFilter) params.set('plan', planFilter);
      params.set('limit', '100');

      const res = await fetch(`/api/v1/admin/users?${params}`, {
        credentials: 'include',
      });
      if (res.status === 403) {
        router.push('/dashboard');
        return;
      }
      if (!res.ok) throw new Error('Failed to fetch users');
      const data = await res.json();
      setUsers(data.data);
    } catch (err) {
      setError('Error cargando usuarios');
      console.error('Error fetching users:', err);
    }
  }, [search, statusFilter, roleFilter, planFilter, router]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await Promise.all([fetchStats(), fetchUsers()]);
      setLoading(false);
    };
    load();
  }, [fetchStats, fetchUsers]);

  const handleStatusChange = async (userId: string, newStatus: string) => {
    try {
      const res = await fetch(`/api/v1/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error('Failed to update user');
      fetchUsers();
      fetchStats();
    } catch (err) {
      alert('Error al actualizar usuario');
      console.error(err);
    }
  };

  const handleSaveUser = async (userId: string, updates: Partial<User>) => {
    const res = await fetch(`/api/v1/admin/users/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(updates),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.message || 'Failed to update user');
    }
    fetchUsers();
    fetchStats();
  };

  const handleDeleteUser = async (userId: string) => {
    const res = await fetch(`/api/v1/admin/users/${userId}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.message || 'Failed to delete user');
    }
    // Update local state immediately to show status change
    setUsers((prevUsers) =>
      prevUsers.map((u) =>
        u.id === userId ? { ...u, status: 'deleted' as const } : u
      )
    );
    fetchStats();
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await fetch('/api/v1/auth/logout', { method: 'POST', credentials: 'include' });
      router.push('/login');
    } catch (error) {
      console.error('Error logging out:', error);
      setLoggingOut(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 text-red-600 p-4 rounded-lg">{error}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Panel de Administracion</h1>
            <p className="text-sm text-gray-500 mt-1">
              Gestiona usuarios, planes y monitorea la actividad de la plataforma
            </p>
          </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              fetchStats();
              fetchUsers();
            }}
            className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg flex items-center gap-2 text-gray-700"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            Actualizar
          </button>
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="px-4 py-2 text-sm bg-red-100 hover:bg-red-200 text-red-700 rounded-lg flex items-center gap-2 disabled:opacity-50"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
              />
            </svg>
            {loggingOut ? 'Saliendo...' : 'Cerrar Sesion'}
          </button>
        </div>
      </div>

      {/* Overview Stats */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Users Overview */}
          <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-gray-500">Usuarios</h3>
              <div className="p-2 bg-blue-100 rounded-lg">
                <svg
                  className="w-5 h-5 text-blue-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z"
                  />
                </svg>
              </div>
            </div>
            <p className="text-3xl font-bold text-gray-900">{stats.users.total}</p>
            <div className="mt-2 flex items-center gap-3 text-sm">
              <span className="text-green-600">{stats.users.active} activos</span>
              <span className="text-gray-300">|</span>
              <span className="text-yellow-600">{stats.users.suspended} suspendidos</span>
            </div>
          </div>

          {/* New Users */}
          <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-gray-500">Crecimiento</h3>
              <div className="p-2 bg-green-100 rounded-lg">
                <svg
                  className="w-5 h-5 text-green-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                  />
                </svg>
              </div>
            </div>
            <p className="text-3xl font-bold text-gray-900">+{stats.users.newThisMonth}</p>
            <p className="text-sm text-gray-500 mt-1">Nuevos este mes</p>
            <div className="mt-2 flex items-center gap-3 text-sm">
              <span className="text-blue-600">+{stats.users.newThisWeek} semana</span>
              <span className="text-gray-300">|</span>
              <span className="text-purple-600">+{stats.users.newToday} hoy</span>
            </div>
          </div>

          {/* Plans Distribution */}
          <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-gray-500">Planes</h3>
              <div className="p-2 bg-amber-100 rounded-lg">
                <svg
                  className="w-5 h-5 text-amber-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"
                  />
                </svg>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Free</span>
                <span className="text-sm font-medium text-gray-900">{stats.users.byPlan.free}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-blue-600">Pro</span>
                <span className="text-sm font-medium text-gray-900">{stats.users.byPlan.pro}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-amber-600">Premium</span>
                <span className="text-sm font-medium text-gray-900">{stats.users.byPlan.premium}</span>
              </div>
            </div>
          </div>

          {/* Activity */}
          <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-gray-500">Actividad</h3>
              <div className="p-2 bg-purple-100 rounded-lg">
                <svg
                  className="w-5 h-5 text-purple-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                  />
                </svg>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Transacciones</span>
                <span className="text-sm font-medium text-gray-900">{stats.transactions.total}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Cuentas</span>
                <span className="text-sm font-medium text-gray-900">{stats.accounts.total}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Sesiones activas</span>
                <span className="text-sm font-medium text-gray-900">{stats.sessions.active}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* User Management Section */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Gestion de Usuarios</h2>
            <span className="text-sm text-gray-500">{users.length} usuarios</span>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-3">
            <input
              type="text"
              placeholder="Buscar por email o nombre..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm w-64"
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm text-gray-900 bg-white"
            >
              <option value="">Activos y suspendidos</option>
              <option value="active">Solo activos</option>
              <option value="suspended">Solo suspendidos</option>
              <option value="deleted">Ver eliminados</option>
            </select>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm text-gray-900 bg-white"
            >
              <option value="">Todos los roles</option>
              <option value="user">Usuarios</option>
              <option value="admin">Admins</option>
              <option value="superadmin">Superadmins</option>
            </select>
            <select
              value={planFilter}
              onChange={(e) => setPlanFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm text-gray-900 bg-white"
            >
              <option value="">Todos los planes</option>
              <option value="free">Free</option>
              <option value="pro">Pro</option>
              <option value="premium">Premium</option>
            </select>
            <button
              onClick={fetchUsers}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
            >
              Buscar
            </button>
          </div>
        </div>

        {/* Users Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Usuario
                </th>
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Estado
                </th>
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Rol
                </th>
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Plan
                </th>
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Registro
                </th>
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ultimo acceso
                </th>
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.map((user) => (
                <UserRow
                  key={user.id}
                  user={user}
                  onEdit={setEditingUser}
                  onStatusChange={handleStatusChange}
                  onDelete={setDeletingUser}
                />
              ))}
            </tbody>
          </table>

          {users.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <svg
                className="w-12 h-12 mx-auto text-gray-300 mb-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                />
              </svg>
              <p>No se encontraron usuarios</p>
              <p className="text-sm mt-1">Intenta ajustar los filtros de busqueda</p>
            </div>
          )}
        </div>
      </div>

      {/* Edit Modal */}
      {editingUser && (
        <EditUserModal
          user={editingUser}
          onClose={() => setEditingUser(null)}
          onSave={handleSaveUser}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deletingUser && (
        <ConfirmDeleteModal
          user={deletingUser}
          onClose={() => setDeletingUser(null)}
          onConfirm={handleDeleteUser}
        />
      )}
      </div>
    </div>
  );
}
