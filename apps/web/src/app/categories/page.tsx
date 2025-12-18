'use client';

import { useState, useEffect } from 'react';
import { formatDate, truncate, type Category } from '@/lib/api';
import { useCategories } from '@/lib/hooks';
import { useToast } from '@/components/ui/toast';
import { CreateCategoryModal } from '@/components/categories/CreateCategoryModal';
import { EditCategoryModal } from '@/components/categories/EditCategoryModal';
import { DeleteCategoryDialog } from '@/components/categories/DeleteCategoryDialog';
import { Sidebar } from '@/components/layout';

export default function CategoriesPage(): React.ReactElement {
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [deletingCategory, setDeletingCategory] = useState<Category | null>(
    null
  );

  const { showToast } = useToast();

  // Use SWR for cached categories - instant navigation!
  const {
    categories,
    nextCursor,
    isLoading: loading,
    error,
    refresh,
  } = useCategories({
    limit: 50,
    q: debouncedQuery || undefined,
  });

  // Show error toast if fetch fails
  useEffect(() => {
    if (error) {
      showToast('Failed to load categories', 'error');
    }
  }, [error, showToast]);

  // Debounced search
  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);

    return () => clearTimeout(timeout);
  }, [searchQuery]);

  const handleLoadMore = () => {
    // For now, just refresh - pagination with SWR needs more work
    refresh();
  };

  const handleRefresh = () => {
    refresh();
  };

  const handleEdit = (category: Category) => {
    setEditingCategory(category);
  };

  const handleDelete = (category: Category) => {
    setDeletingCategory(category);
  };

  // Find parent name for display
  const getParentName = (parentId: string | null): string => {
    if (!parentId) return '—';
    const parent = categories.find((c) => c.id === parentId);
    return parent ? parent.name : '(Unknown)';
  };

  return (
    <Sidebar>
      <div className="min-h-screen bg-gray-950">
        {/* Animated Background */}
        <div className="fixed inset-0 z-0 pointer-events-none">
          <div className="absolute top-0 -left-40 w-96 h-96 bg-purple-600 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-blob"></div>
          <div className="absolute top-0 -right-40 w-96 h-96 bg-cyan-600 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-blob animation-delay-2000"></div>
          <div className="absolute -bottom-40 left-40 w-96 h-96 bg-pink-600 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-blob animation-delay-4000"></div>
        </div>

        <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 py-6 lg:py-8">
          {/* Header */}
          <div className="mb-6 lg:mb-8">
            <h1 className="text-2xl lg:text-3xl font-bold text-white mb-1 lg:mb-2 flex items-center gap-2">
              <span>🏷️</span> Categorías
            </h1>
            <p className="text-sm lg:text-base text-gray-400">
              Administra tus categorías de presupuesto y su jerarquía
            </p>
          </div>

          {/* Actions Bar */}
          <div className="bg-gray-900/50 backdrop-blur-xl rounded-2xl border border-gray-800 p-4 mb-6 flex flex-col sm:flex-row gap-4 items-stretch sm:items-center justify-between">
            <div className="flex-1 w-full sm:max-w-md">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="🔍 Buscar categorías..."
                className="w-full px-4 py-2 bg-gray-800/50 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-all text-sm lg:text-base"
              />
            </div>

            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-600 hover:to-purple-600 text-white rounded-xl font-medium whitespace-nowrap transition-all text-sm lg:text-base"
            >
              ➕ Nueva Categoría
            </button>
          </div>

          {/* Loading State */}
          {loading && categories.length === 0 && (
            <div className="bg-gray-900/50 backdrop-blur-xl rounded-2xl border border-gray-800 p-8 text-center">
              <div className="inline-flex items-center gap-3">
                <div className="w-5 h-5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-gray-400 text-sm lg:text-base">
                  Cargando categorías...
                </p>
              </div>
            </div>
          )}

          {/* Empty State */}
          {!loading && categories.length === 0 && (
            <div className="bg-gray-900/50 backdrop-blur-xl rounded-2xl border border-gray-800 p-8 text-center">
              <span className="text-4xl mb-4 block">📭</span>
              <p className="text-gray-400 mb-4 text-sm lg:text-base">
                {searchQuery
                  ? 'No se encontraron categorías que coincidan con tu búsqueda'
                  : 'Aún no hay categorías'}
              </p>
              {!searchQuery && (
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-600 hover:to-purple-600 text-white rounded-xl transition-all text-sm lg:text-base"
                >
                  ➕ Crear Tu Primera Categoría
                </button>
              )}
            </div>
          )}

          {/* Categories - Desktop Table */}
          {categories.length > 0 && (
            <>
              {/* Desktop Table View */}
              <div className="hidden lg:block bg-gray-900/50 backdrop-blur-xl rounded-2xl border border-gray-800 overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-900/80 border-b border-gray-800">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                        Nombre
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                        Padre
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                        Creado
                      </th>
                      <th className="px-6 py-4 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                        Acciones
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {categories.map((category) => {
                      const parentName = getParentName(category.parentId);
                      const hasParent = category.parentId !== null;

                      return (
                        <tr
                          key={category.id}
                          className="hover:bg-gray-800/50 transition-colors"
                        >
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              {hasParent && (
                                <span className="text-cyan-400 mr-2">↳</span>
                              )}
                              <span className="text-sm font-medium text-white">
                                {truncate(category.name)}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                            {truncate(parentName, 32)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                            {formatDate(category.createdAt)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <button
                              onClick={() => handleEdit(category)}
                              className="text-cyan-400 hover:text-cyan-300 mr-4 transition-colors"
                            >
                              ✏️ Editar
                            </button>
                            <button
                              onClick={() => handleDelete(category)}
                              className="text-red-400 hover:text-red-300 transition-colors"
                            >
                              🗑️ Eliminar
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {/* Load More - Desktop */}
                {nextCursor && (
                  <div className="px-6 py-4 bg-gray-900/80 border-t border-gray-800 text-center">
                    <button
                      onClick={handleLoadMore}
                      disabled={loading}
                      className="px-4 py-2 text-sm font-medium text-cyan-400 hover:text-cyan-300 disabled:opacity-50 transition-colors"
                    >
                      {loading ? 'Cargando...' : 'Cargar Más →'}
                    </button>
                  </div>
                )}
              </div>

              {/* Mobile Card View */}
              <div className="lg:hidden space-y-3">
                {categories.map((category) => {
                  const parentName = getParentName(category.parentId);
                  const hasParent = category.parentId !== null;

                  return (
                    <div
                      key={category.id}
                      className="bg-gray-900/50 backdrop-blur-xl rounded-xl border border-gray-800 p-4 hover:border-gray-700 transition-colors"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center">
                          {hasParent && (
                            <span className="text-cyan-400 mr-2">↳</span>
                          )}
                          <span className="font-medium text-white">
                            {truncate(category.name, 30)}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 text-xs text-gray-400 mb-3">
                        <span>Padre: {truncate(parentName, 20)}</span>
                        <span>•</span>
                        <span>{formatDate(category.createdAt)}</span>
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEdit(category)}
                          className="flex-1 py-2 px-3 bg-gray-800 hover:bg-gray-700 text-cyan-400 rounded-lg text-sm transition-colors"
                        >
                          ✏️ Editar
                        </button>
                        <button
                          onClick={() => handleDelete(category)}
                          className="flex-1 py-2 px-3 bg-gray-800 hover:bg-gray-700 text-red-400 rounded-lg text-sm transition-colors"
                        >
                          🗑️ Eliminar
                        </button>
                      </div>
                    </div>
                  );
                })}

                {/* Load More - Mobile */}
                {nextCursor && (
                  <div className="text-center py-4">
                    <button
                      onClick={handleLoadMore}
                      disabled={loading}
                      className="px-6 py-3 bg-gray-800 hover:bg-gray-700 text-cyan-400 rounded-xl text-sm font-medium disabled:opacity-50 transition-colors"
                    >
                      {loading ? 'Cargando...' : 'Cargar Más →'}
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Modals */}
        <CreateCategoryModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onSuccess={handleRefresh}
        />

        <EditCategoryModal
          category={editingCategory}
          isOpen={editingCategory !== null}
          onClose={() => setEditingCategory(null)}
          onSuccess={handleRefresh}
        />

        <DeleteCategoryDialog
          category={deletingCategory}
          isOpen={deletingCategory !== null}
          onClose={() => setDeletingCategory(null)}
          onSuccess={handleRefresh}
        />
      </div>
    </Sidebar>
  );
}
