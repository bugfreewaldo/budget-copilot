'use client';

import { useState, useEffect, useMemo } from 'react';
import { type Category } from '@/lib/api';

interface CategoryPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (categoryId: string | null) => void;
  categories: Category[];
  selectedCategoryId: string | null;
}

export function CategoryPickerModal({
  isOpen,
  onClose,
  onSelect,
  categories,
  selectedCategoryId,
}: CategoryPickerModalProps): React.JSX.Element | null {
  const [searchQuery, setSearchQuery] = useState('');

  // Reset search when modal opens
  useEffect(() => {
    if (isOpen) {
      setSearchQuery('');
    }
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Organize categories hierarchically
  const organizedCategories = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();

    // If searching, return flat filtered list
    if (query) {
      return {
        isSearching: true,
        flat: categories.filter(
          (cat) =>
            cat.name.toLowerCase().includes(query) ||
            (cat.emoji && cat.emoji.includes(query))
        ),
        groups: [],
      };
    }

    // Group by parent
    const parents = categories.filter((c) => !c.parentId);
    const childrenByParent = new Map<string, typeof categories>();

    for (const cat of categories) {
      if (cat.parentId) {
        const existing = childrenByParent.get(cat.parentId) || [];
        existing.push(cat);
        childrenByParent.set(cat.parentId, existing);
      }
    }

    // Sort parents alphabetically, and children within each group
    const sortedParents = [...parents].sort((a, b) =>
      a.name.localeCompare(b.name)
    );

    const groups = sortedParents.map((parent) => ({
      parent,
      children: (childrenByParent.get(parent.id) || []).sort((a, b) =>
        a.name.localeCompare(b.name)
      ),
    }));

    return { isSearching: false, flat: [], groups };
  }, [categories, searchQuery]);

  const handleSelect = (e: React.MouseEvent, categoryId: string | null) => {
    e.stopPropagation();
    onSelect(categoryId);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-gray-900 rounded-2xl border border-gray-800 w-full max-w-2xl max-h-[80vh] shadow-2xl animate-in fade-in zoom-in-95 duration-200 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-800 flex-shrink-0">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <span>📂</span> Seleccionar Categoría
            </h3>
            <button
              onClick={onClose}
              className="p-2 text-gray-500 hover:text-white hover:bg-gray-800 rounded-lg transition-all"
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
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Search Input */}
          <div className="relative">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="text"
              placeholder="Buscar categoría..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
              className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50"
            />
          </div>
        </div>

        {/* Categories */}
        <div className="p-4 overflow-y-auto flex-1">
          {/* No Category Option */}
          <button
            onClick={(e) => handleSelect(e, null)}
            className={`w-full mb-4 p-3 rounded-xl border transition-all text-left flex items-center gap-3 ${
              selectedCategoryId === null
                ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-400'
                : 'bg-gray-800/50 border-gray-700 text-gray-400 hover:bg-gray-800 hover:border-gray-600'
            }`}
          >
            <span className="text-xl w-8 h-8 flex items-center justify-center bg-gray-700 rounded-lg">
              ➖
            </span>
            <span className="font-medium">Sin categoría</span>
          </button>

          {/* Search Results (flat list) */}
          {organizedCategories.isSearching && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {organizedCategories.flat.map((category) => (
                  <button
                    key={category.id}
                    onClick={(e) => handleSelect(e, category.id)}
                    className={`p-3 rounded-xl border transition-all text-left flex items-center gap-3 ${
                      selectedCategoryId === category.id
                        ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-400'
                        : 'bg-gray-800/50 border-gray-700 text-gray-300 hover:bg-gray-800 hover:border-gray-600'
                    }`}
                  >
                    <span className="text-xl w-8 h-8 flex items-center justify-center bg-gray-700 rounded-lg">
                      {category.emoji || '📁'}
                    </span>
                    <span className="font-medium truncate">
                      {category.name}
                    </span>
                  </button>
                ))}
              </div>
              {organizedCategories.flat.length === 0 && (
                <div className="text-center py-8">
                  <span className="text-4xl mb-3 block">🔍</span>
                  <p className="text-gray-400">
                    No se encontraron categorías con "{searchQuery}"
                  </p>
                </div>
              )}
            </>
          )}

          {/* Hierarchical View (grouped by parent) */}
          {!organizedCategories.isSearching && (
            <div className="space-y-4">
              {organizedCategories.groups.map(({ parent, children }) => (
                <div key={parent.id} className="space-y-2">
                  {/* Parent Category Header */}
                  <button
                    onClick={(e) => handleSelect(e, parent.id)}
                    className={`w-full p-3 rounded-xl border transition-all text-left flex items-center gap-3 ${
                      selectedCategoryId === parent.id
                        ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-400'
                        : 'bg-gray-800 border-gray-700 text-white hover:bg-gray-700 hover:border-gray-600'
                    }`}
                  >
                    <span className="text-xl w-8 h-8 flex items-center justify-center bg-gray-700 rounded-lg">
                      {parent.emoji || '📁'}
                    </span>
                    <span className="font-semibold">{parent.name}</span>
                    {children.length > 0 && (
                      <span className="ml-auto text-xs text-gray-500 bg-gray-700 px-2 py-0.5 rounded-full">
                        {children.length}
                      </span>
                    )}
                  </button>

                  {/* Children */}
                  {children.length > 0 && (
                    <div className="ml-4 pl-4 border-l-2 border-gray-800 grid grid-cols-2 gap-2">
                      {children.map((child) => (
                        <button
                          key={child.id}
                          onClick={(e) => handleSelect(e, child.id)}
                          className={`p-2.5 rounded-xl border transition-all text-left flex items-center gap-2 ${
                            selectedCategoryId === child.id
                              ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-400'
                              : 'bg-gray-800/50 border-gray-700 text-gray-300 hover:bg-gray-800 hover:border-gray-600'
                          }`}
                        >
                          <span className="text-lg w-7 h-7 flex items-center justify-center bg-gray-700 rounded-lg">
                            {child.emoji || '📁'}
                          </span>
                          <span className="text-sm font-medium truncate">
                            {child.name}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-800 flex-shrink-0">
          <p className="text-sm text-gray-500 text-center">
            {categories.length} categorías disponibles
          </p>
        </div>
      </div>
    </div>
  );
}
