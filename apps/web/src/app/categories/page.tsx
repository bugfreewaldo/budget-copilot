'use client';

import { useState, useEffect, useMemo } from 'react';
import { type Category } from '@/lib/api';
import { useCategories } from '@/lib/hooks';
import { useToast } from '@/components/ui/toast';
import { CreateCategoryModal } from '@/components/categories/CreateCategoryModal';
import { EditCategoryModal } from '@/components/categories/EditCategoryModal';
import { DeleteCategoryDialog } from '@/components/categories/DeleteCategoryDialog';
import { Sidebar } from '@/components/layout';

interface CategoryGroup {
  parent: Category;
  children: Category[];
}

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
    limit: 500,
    flat: true,
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

  // Group categories: parents with their children, standalone categories solo
  const groupedCategories = useMemo(() => {
    const parentMap = new Map<string, Category>();
    const childrenMap = new Map<string, Category[]>();
    const standalone: Category[] = [];

    // First pass: identify parents
    for (const cat of categories) {
      if (!cat.parentId) {
        parentMap.set(cat.id, cat);
      }
    }

    // Second pass: group children under parents
    for (const cat of categories) {
      if (cat.parentId && parentMap.has(cat.parentId)) {
        const existing = childrenMap.get(cat.parentId) || [];
        existing.push(cat);
        childrenMap.set(cat.parentId, existing);
      } else if (cat.parentId && !parentMap.has(cat.parentId)) {
        // Orphaned child — show standalone
        standalone.push(cat);
      }
    }

    // Build grouped list
    const groups: CategoryGroup[] = [];
    for (const parent of parentMap.values()) {
      groups.push({
        parent,
        children: childrenMap.get(parent.id) || [],
      });
    }

    // Sort groups by parent name
    groups.sort((a, b) => a.parent.name.localeCompare(b.parent.name));

    return { groups, standalone };
  }, [categories]);

  const handleLoadMore = () => {
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
              <span>🏷️</span> Categories
            </h1>
            <p className="text-sm lg:text-base text-gray-400">
              Manage your budget categories and their hierarchy
            </p>
          </div>

          {/* Actions Bar */}
          <div className="bg-gray-900/50 backdrop-blur-xl rounded-2xl border border-gray-800 p-4 mb-6 flex flex-col sm:flex-row gap-4 items-stretch sm:items-center justify-between">
            <div className="flex-1 w-full sm:max-w-md">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="🔍 Search categories..."
                className="w-full px-4 py-2 bg-gray-800/50 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-all text-sm lg:text-base"
              />
            </div>

            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-600 hover:to-purple-600 text-white rounded-xl font-medium whitespace-nowrap transition-all text-sm lg:text-base"
            >
              ➕ New Category
            </button>
          </div>

          {/* Loading State */}
          {loading && categories.length === 0 && (
            <div className="bg-gray-900/50 backdrop-blur-xl rounded-2xl border border-gray-800 p-8 text-center">
              <div className="inline-flex items-center gap-3">
                <div className="w-5 h-5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-gray-400 text-sm lg:text-base">
                  Loading categories...
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
                  ? 'No categories found matching your search'
                  : 'No categories yet'}
              </p>
              {!searchQuery && (
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-600 hover:to-purple-600 text-white rounded-xl transition-all text-sm lg:text-base"
                >
                  ➕ Create Your First Category
                </button>
              )}
            </div>
          )}

          {/* Categories - Grouped by Parent */}
          {categories.length > 0 && (
            <div className="space-y-4">
              {groupedCategories.groups.map(({ parent, children }) => (
                <div
                  key={parent.id}
                  className="bg-gray-900/50 backdrop-blur-xl rounded-2xl border border-gray-800 overflow-hidden"
                >
                  {/* Parent Header */}
                  <div className="flex items-center justify-between px-4 lg:px-6 py-3 lg:py-4 bg-gray-900/80 border-b border-gray-800">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{parent.emoji}</span>
                      <span className="font-semibold text-white text-sm lg:text-base">
                        {parent.name}
                      </span>
                      {children.length > 0 && (
                        <span className="text-xs text-gray-500 ml-1">
                          ({children.length})
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleEdit(parent)}
                        className="p-1.5 text-gray-500 hover:text-cyan-400 hover:bg-cyan-500/10 rounded-lg transition-all"
                        title="Edit"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                          />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDelete(parent)}
                        className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                        title="Delete"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* Children */}
                  {children.length > 0 && (
                    <div className="divide-y divide-gray-800/50">
                      {children.map((child) => (
                        <div
                          key={child.id}
                          className="flex items-center justify-between px-4 lg:px-6 py-2.5 lg:py-3 hover:bg-gray-800/30 transition-colors"
                        >
                          <div className="flex items-center gap-2 pl-4 lg:pl-6">
                            <span className="text-gray-600 text-xs">↳</span>
                            <span className="text-sm">{child.emoji}</span>
                            <span className="text-sm text-gray-300">
                              {child.name}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleEdit(child)}
                              className="p-1.5 text-gray-600 hover:text-cyan-400 hover:bg-cyan-500/10 rounded-lg transition-all"
                              title="Edit"
                            >
                              <svg
                                className="w-3.5 h-3.5"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                                />
                              </svg>
                            </button>
                            <button
                              onClick={() => handleDelete(child)}
                              className="p-1.5 text-gray-600 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                              title="Delete"
                            >
                              <svg
                                className="w-3.5 h-3.5"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                />
                              </svg>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}

              {/* Standalone categories (orphans) */}
              {groupedCategories.standalone.length > 0 && (
                <div className="bg-gray-900/50 backdrop-blur-xl rounded-2xl border border-gray-800 overflow-hidden">
                  <div className="px-4 lg:px-6 py-3 lg:py-4 bg-gray-900/80 border-b border-gray-800">
                    <span className="font-semibold text-white text-sm lg:text-base">
                      Other
                    </span>
                  </div>
                  <div className="divide-y divide-gray-800/50">
                    {groupedCategories.standalone.map((cat) => (
                      <div
                        key={cat.id}
                        className="flex items-center justify-between px-4 lg:px-6 py-2.5 lg:py-3 hover:bg-gray-800/30 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-sm">{cat.emoji}</span>
                          <span className="text-sm text-gray-300">
                            {cat.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleEdit(cat)}
                            className="p-1.5 text-gray-600 hover:text-cyan-400 hover:bg-cyan-500/10 rounded-lg transition-all"
                            title="Edit"
                          >
                            <svg
                              className="w-3.5 h-3.5"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                              />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDelete(cat)}
                            className="p-1.5 text-gray-600 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                            title="Delete"
                          >
                            <svg
                              className="w-3.5 h-3.5"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                              />
                            </svg>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Load More */}
              {nextCursor && (
                <div className="text-center py-4">
                  <button
                    onClick={handleLoadMore}
                    disabled={loading}
                    className="px-6 py-3 bg-gray-800 hover:bg-gray-700 text-cyan-400 rounded-xl text-sm font-medium disabled:opacity-50 transition-colors"
                  >
                    {loading ? 'Loading...' : 'Load More'}
                  </button>
                </div>
              )}
            </div>
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
