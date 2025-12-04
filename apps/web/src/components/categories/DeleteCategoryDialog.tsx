'use client';

import { useState } from 'react';
import { deleteCategory, type Category, ApiError } from '@/lib/api';
import { useToast } from '@/components/ui/toast';

interface DeleteCategoryDialogProps {
  category: Category | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function DeleteCategoryDialog({
  category,
  isOpen,
  onClose,
  onSuccess,
}: DeleteCategoryDialogProps) {
  const [loading, setLoading] = useState(false);
  const { showToast } = useToast();

  const handleDelete = async () => {
    if (!category) return;

    setLoading(true);

    try {
      await deleteCategory(category.id);
      showToast('Category deleted successfully', 'success');
      onSuccess();
      onClose();
    } catch (error) {
      let message = 'Failed to delete category';

      if (error instanceof ApiError) {
        if (error.statusCode === 404) {
          message = 'Category not found';
        } else if (error.statusCode === 409) {
          // Extract user-friendly message from Problem+JSON detail
          message =
            error.problem?.detail || 'Cannot delete category that is in use';
        } else {
          message = error.message;
        }
      } else if (error instanceof Error) {
        message = error.message;
      }

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
        aria-labelledby="delete-category-title"
      >
        <div className="p-6">
          <h2
            id="delete-category-title"
            className="text-xl font-semibold text-white mb-4 flex items-center gap-2"
          >
            <span>🗑️</span> Eliminar Categoría
          </h2>

          <p className="text-gray-300 mb-6">
            ¿Estás seguro de que quieres eliminar{' '}
            <span className="font-semibold text-white">{category.name}</span>?
            Esta acción no se puede deshacer.
          </p>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={handleClose}
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-gray-300 bg-gray-800 border border-gray-700 rounded-xl hover:bg-gray-700 disabled:opacity-50 transition-all"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {loading ? 'Eliminando...' : '🗑️ Eliminar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
