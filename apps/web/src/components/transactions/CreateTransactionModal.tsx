'use client';

import { useState, useEffect, useRef } from 'react';
import {
  createTransaction,
  updateTransaction,
  createAccount,
  listCategories,
  getAccounts,
  getToday,
  type Category,
  type Transaction,
} from '@/lib/api';
import { useToast } from '@/components/ui/toast';

interface CreateTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  defaultType?: 'income' | 'expense';
  editingTransaction?: Transaction | null;
}

export function CreateTransactionModal({
  isOpen,
  onClose,
  onSuccess,
  defaultType = 'expense',
  editingTransaction,
}: CreateTransactionModalProps) {
  const [type, setType] = useState<'income' | 'expense'>(defaultType);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [sensitive, setSensitive] = useState(false);
  const [date, setDate] = useState(getToday());
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [accountId, setAccountId] = useState<string | null>(null);
  const { showToast } = useToast();
  const amountInputRef = useRef<HTMLInputElement>(null);

  const isEditing = !!editingTransaction;

  // Reset form and load data when modal opens
  useEffect(() => {
    if (isOpen) {
      // If editing, populate form with existing values
      if (editingTransaction) {
        setType(editingTransaction.type);
        setAmount((editingTransaction.amountCents / 100).toString());
        setDescription(editingTransaction.description);
        setCategoryId(editingTransaction.categoryId || '');
        setSensitive(editingTransaction.sensitive ?? false);
        setDate(editingTransaction.date);
      } else {
        setType(defaultType);
        setAmount('');
        setDescription('');
        setCategoryId('');
        setSensitive(false);
        setDate(getToday());
      }

      // Load categories (flat=true to get all including subcategories)
      listCategories({ limit: 500, flat: true })
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
  }, [isOpen, defaultType, editingTransaction]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const amountNum = parseFloat(amount);
    if (!amount.trim() || isNaN(amountNum) || amountNum === 0) {
      showToast('Enter a valid amount', 'error');
      return;
    }

    if (!description.trim()) {
      showToast('Enter a description', 'error');
      return;
    }

    if (!accountId) {
      showToast('Error: Could not create account. Please try again.', 'error');
      return;
    }

    setLoading(true);

    try {
      if (isEditing && editingTransaction) {
        await updateTransaction(editingTransaction.id, {
          date,
          description: description.trim(),
          amountCents: Math.round(amountNum * 100),
          type,
          categoryId: categoryId || null,
          sensitive,
        });
        showToast('Transaction updated', 'success');
      } else {
        await createTransaction({
          date,
          description: description.trim(),
          amountCents: Math.round(amountNum * 100),
          type,
          categoryId: categoryId || undefined,
          accountId,
          cleared: true,
          sensitive,
        });
        showToast(
          type === 'income' ? 'Income recorded' : 'Expense recorded',
          'success'
        );
      }
      onSuccess();
      onClose();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : isEditing
            ? 'Failed to update transaction'
            : 'Failed to create transaction';
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
            {isEditing
              ? 'Edit Transaction'
              : isExpense
                ? 'Add Expense'
                : 'Add Income'}
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
              Expense
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
              Income
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Amount */}
            <div>
              <label
                htmlFor="amount"
                className="block text-sm font-medium text-gray-300 mb-1"
              >
                Amount <span className="text-red-400">*</span>
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
                Description <span className="text-red-400">*</span>
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
                  isExpense ? 'e.g., Grocery shopping' : 'e.g., Monthly salary'
                }
              />
            </div>

            {/* Date */}
            <div>
              <label
                htmlFor="date"
                className="block text-sm font-medium text-gray-300 mb-1"
              >
                Date
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
                Category
              </label>
              <select
                id="category"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                disabled={loading}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 disabled:opacity-50 transition-all"
              >
                <option value="">No category</option>
                {(() => {
                  const parents = categories
                    .filter((c) => !c.parentId)
                    .sort((a, b) => a.name.localeCompare(b.name));
                  return parents.map((parent) => {
                    const children = categories
                      .filter((c) => c.parentId === parent.id)
                      .sort((a, b) => a.name.localeCompare(b.name));
                    if (children.length > 0) {
                      return (
                        <optgroup
                          key={parent.id}
                          label={`${parent.emoji || ''} ${parent.name}`}
                        >
                          <option value={parent.id}>
                            {parent.emoji || ''} {parent.name} (general)
                          </option>
                          {children.map((child) => (
                            <option key={child.id} value={child.id}>
                              {child.emoji || ''} {child.name}
                            </option>
                          ))}
                        </optgroup>
                      );
                    }
                    return (
                      <option key={parent.id} value={parent.id}>
                        {parent.emoji || ''} {parent.name}
                      </option>
                    );
                  });
                })()}
              </select>
            </div>

            {/* Sensitive Toggle */}
            <label className="flex items-center gap-3 cursor-pointer group">
              <div className="relative">
                <input
                  type="checkbox"
                  checked={sensitive}
                  onChange={(e) => setSensitive(e.target.checked)}
                  disabled={loading}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-gray-700 rounded-full peer-checked:bg-purple-500 transition-colors"></div>
                <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-gray-300 rounded-full peer-checked:translate-x-4 peer-checked:bg-white transition-transform"></div>
              </div>
              <span className="text-sm text-gray-400 group-hover:text-gray-300 transition-colors">
                🔒 Hide description
              </span>
            </label>

            {/* Buttons */}
            <div className="flex justify-end gap-3 mt-6">
              <button
                type="button"
                onClick={handleClose}
                disabled={loading}
                className="px-4 py-2 text-sm font-medium text-gray-300 bg-gray-800 border border-gray-700 rounded-xl hover:bg-gray-700 disabled:opacity-50 transition-all"
              >
                Cancel
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
                  ? 'Saving...'
                  : isEditing
                    ? '✓ Save Changes'
                    : `✓ ${isExpense ? 'Add Expense' : 'Add Income'}`}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
