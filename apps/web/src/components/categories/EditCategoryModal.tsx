'use client';

import { useState, useEffect, useRef } from 'react';
import {
  updateCategory,
  listCategories,
  type Category,
} from '@/lib/api';
import { useToast } from '@/components/ui/toast';

interface EditCategoryModalProps {
  category: Category | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function EditCategoryModal({
  category,
  isOpen,
  onClose,
  onSuccess,
}: EditCategoryModalProps) {
  const [name, setName] = useState('');
  const [parentId, setParentId] = useState<string>('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const { showToast } = useToast();
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Initialize form when category changes
  useEffect(() => {
    if (category) {
      setName(category.name);
      setParentId(category.parentId || '');
    }
  }, [category]);

  // Load categories for parent selection
  useEffect(() => {
    if (isOpen && category) {
      listCategories({ limit: 100 })
        .then((result) => {
          // Exclude the current category and its descendants from parent options
          const filtered = result.data.filter((c) => c.id !== category.id);
          setCategories(filtered);
        })
        .catch(() => setCategories([]));

      // Focus name input when modal opens
      setTimeout(() => nameInputRef.current?.focus(), 100);
    }
  }, [isOpen, category]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!category) return;

    if (!name.trim()) {
      showToast('Category name is required', 'error');
      return;
    }

    setLoading(true);

    try {
      await updateCategory(category.id, {
        name: name.trim(),
        parent_id: parentId || null,
      });

      showToast('Category updated successfully', 'success');
      onSuccess();
      onClose();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to update category';
      showToast(message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      onClose();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape' && !loading) {
      handleClose();
    }
  };

  if (!isOpen || !category) return null;

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-40"
      onClick={handleClose}
      onKeyDown={handleKeyDown}
    >
      <div
        className="bg-gray-900 rounded-2xl border border-gray-800 shadow-2xl max-w-md w-full mx-4 animate-fade-in"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-category-title"
      >
        <div className="p-6">
          <h2
            id="edit-category-title"
            className="text-xl font-semibold text-white mb-4 flex items-center gap-2"
          >
            <span>✏️</span> Editar Categoría
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="name"
                className="block text-sm font-medium text-gray-300 mb-1"
              >
                Nombre <span className="text-red-400">*</span>
              </label>
              <input
                ref={nameInputRef}
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={64}
                disabled={loading}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 disabled:opacity-50 transition-all"
              />
            </div>

            <div>
              <label
                htmlFor="parent"
                className="block text-sm font-medium text-gray-300 mb-1"
              >
                Categoría Padre (Opcional)
              </label>
              <select
                id="parent"
                value={parentId}
                onChange={(e) => setParentId(e.target.value)}
                disabled={loading}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 disabled:opacity-50 transition-all"
              >
                <option value="">Ninguna</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                type="button"
                onClick={handleClose}
                disabled={loading}
                className="px-4 py-2 text-sm font-medium text-gray-300 bg-gray-800 border border-gray-700 rounded-xl hover:bg-gray-700 disabled:opacity-50 transition-all"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading || !name.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-600 hover:to-purple-600 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {loading ? 'Guardando...' : '✓ Guardar Cambios'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
