'use client';

import { useState, useEffect, useRef } from 'react';
import {
  createTransaction,
  createAccount,
  listCategories,
  getAccounts,
  getToday,
  type Category,
} from '@/lib/api';
import { useToast } from '@/components/ui/toast';

interface CreateTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  defaultType?: 'income' | 'expense';
}

export function CreateTransactionModal({
  isOpen,
  onClose,
  onSuccess,
  defaultType = 'expense',
}: CreateTransactionModalProps) {
  const [type, setType] = useState<'income' | 'expense'>(defaultType);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [date, setDate] = useState(getToday());
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [accountId, setAccountId] = useState<string | null>(null);
  const { showToast } = useToast();
  const amountInputRef = useRef<HTMLInputElement>(null);

  // Reset form and load data when modal opens
  useEffect(() => {
    if (isOpen) {
      setType(defaultType);
      setAmount('');
      setDescription('');
      setCategoryId('');
      setDate(getToday());

      // Load categories
      listCategories({ limit: 100 })
        .then((result) => setCategories(result.data))
        .catch(() => setCategories([]));

      // Get or create default account (hidden from user)
      getAccounts()
        .then(async (result) => {
          if (result.length === 0) {
            // Create a default "Efectivo" account
            try {
              const newAccount = await createAccount({
                name: 'Efectivo',
                type: 'cash',
              });
              setAccountId(newAccount.id);
            } catch {
              setAccountId(null);
            }
          } else {
            setAccountId(result[0]!.id);
          }
        })
        .catch(() => setAccountId(null));

      // Focus amount input when modal opens
      setTimeout(() => amountInputRef.current?.focus(), 100);
    }
  }, [isOpen, defaultType]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const amountNum = parseFloat(amount);
    if (!amount.trim() || isNaN(amountNum) || amountNum <= 0) {
      showToast('Ingresa un monto válido', 'error');
      return;
    }

    if (!description.trim()) {
      showToast('Ingresa una descripción', 'error');
      return;
    }

    if (!accountId) {
      showToast(
        'Error: No se pudo crear la cuenta. Intenta de nuevo.',
        'error'
      );
      return;
    }

    setLoading(true);

    try {
      await createTransaction({
        date,
        description: description.trim(),
        amountCents: Math.round(amountNum * 100),
        type,
        categoryId: categoryId || undefined,
        accountId,
        cleared: true,
      });

      showToast(
        type === 'income' ? 'Ingreso registrado' : 'Gasto registrado',
        'success'
      );
      onSuccess();
      onClose();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Error al crear transacción';
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

  if (!isOpen) return null;

  const isExpense = type === 'expense';

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
        aria-labelledby="create-transaction-title"
      >
        <div className="p-6">
          <h2
            id="create-transaction-title"
            className="text-xl font-semibold text-white mb-4 flex items-center gap-2"
          >
            <span>{isExpense ? '💸' : '💰'}</span>
            {isExpense ? 'Agregar Gasto' : 'Agregar Ingreso'}
          </h2>

          {/* Type Toggle */}
          <div className="flex gap-2 mb-4">
            <button
              type="button"
              onClick={() => setType('expense')}
              className={`flex-1 py-2 px-4 rounded-xl font-medium transition-all ${
                isExpense
                  ? 'bg-red-500/20 text-red-400 border border-red-500/50'
                  : 'bg-gray-800 text-gray-400 border border-gray-700 hover:bg-gray-700'
              }`}
            >
              Gasto
            </button>
            <button
              type="button"
              onClick={() => setType('income')}
              className={`flex-1 py-2 px-4 rounded-xl font-medium transition-all ${
                !isExpense
                  ? 'bg-green-500/20 text-green-400 border border-green-500/50'
                  : 'bg-gray-800 text-gray-400 border border-gray-700 hover:bg-gray-700'
              }`}
            >
              Ingreso
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Amount */}
            <div>
              <label
                htmlFor="amount"
                className="block text-sm font-medium text-gray-300 mb-1"
              >
                Monto <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                  $
                </span>
                <input
                  ref={amountInputRef}
                  id="amount"
                  type="number"
                  step="0.01"
                  min="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  disabled={loading}
                  className="w-full pl-8 pr-3 py-2 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 disabled:opacity-50 transition-all"
                  placeholder="0.00"
                />
              </div>
            </div>

            {/* Description */}
            <div>
              <label
                htmlFor="description"
                className="block text-sm font-medium text-gray-300 mb-1"
              >
                Descripción <span className="text-red-400">*</span>
              </label>
              <input
                id="description"
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={100}
                disabled={loading}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 disabled:opacity-50 transition-all"
                placeholder={
                  isExpense
                    ? 'ej., Compras en supermercado'
                    : 'ej., Salario mensual'
                }
              />
            </div>

            {/* Date */}
            <div>
              <label
                htmlFor="date"
                className="block text-sm font-medium text-gray-300 mb-1"
              >
                Fecha
              </label>
              <input
                id="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                disabled={loading}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 disabled:opacity-50 transition-all"
              />
            </div>

            {/* Category */}
            <div>
              <label
                htmlFor="category"
                className="block text-sm font-medium text-gray-300 mb-1"
              >
                Categoría
              </label>
              <select
                id="category"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                disabled={loading}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 disabled:opacity-50 transition-all"
              >
                <option value="">Sin categoría</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.emoji} {cat.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Buttons */}
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
                disabled={
                  loading || !amount.trim() || !description.trim() || !accountId
                }
                className={`px-4 py-2 text-sm font-medium text-white rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all ${
                  isExpense
                    ? 'bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600'
                    : 'bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600'
                }`}
              >
                {loading
                  ? 'Guardando...'
                  : `✓ ${isExpense ? 'Agregar Gasto' : 'Agregar Ingreso'}`}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
