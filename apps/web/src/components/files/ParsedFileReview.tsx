'use client';

import { useState, useEffect } from 'react';
import {
  getFileSummary,
  importFileItems,
  formatCents,
  getAccounts,
  isReceipt,
  isBankStatement,
  type FileSummaryResponse,
  type ParsedSummary,
  type Account,
} from '@/lib/api';
import { useToast } from '@/components/ui/toast';

interface ParsedFileReviewProps {
  fileId: string;
  filename: string;
  onImportComplete?: () => void;
  onClose?: () => void;
}

export function ParsedFileReview({
  fileId,
  filename,
  onImportComplete,
  onClose,
}: ParsedFileReviewProps) {
  const [summary, setSummary] = useState<FileSummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [importing, setImporting] = useState(false);
  const { showToast } = useToast();

  // Load summary and accounts
  useEffect(() => {
    let cancelled = false;
    let pollInterval: NodeJS.Timeout | null = null;

    const loadData = async () => {
      try {
        const [summaryData, accountsData] = await Promise.all([
          getFileSummary(fileId),
          getAccounts(),
        ]);

        if (cancelled) return;

        setSummary(summaryData);
        setAccounts(accountsData);
        if (accountsData.length > 0) {
          setSelectedAccountId(accountsData[0]!.id);
        }

        // Pre-select all items
        const allItemIds = getItemIds(summaryData.summary);
        const unimportedItems = allItemIds.filter(
          (id) => !summaryData.importedItemIds.includes(id)
        );
        setSelectedItems(new Set(unimportedItems));

        setLoading(false);
      } catch (err) {
        if (cancelled) return;

        // If still processing, poll
        if (err instanceof Error && err.message.includes('PROCESSING')) {
          pollInterval = setTimeout(loadData, 3000);
          return;
        }

        setError(err instanceof Error ? err.message : 'Error al cargar');
        setLoading(false);
      }
    };

    loadData();

    return () => {
      cancelled = true;
      if (pollInterval) clearTimeout(pollInterval);
    };
  }, [fileId]);

  const getItemIds = (s: ParsedSummary): string[] => {
    if (isReceipt(s)) {
      return ['main'];
    }
    return s.transactions.map((t) => t.id);
  };

  const toggleItem = (id: string) => {
    setSelectedItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleAll = () => {
    if (!summary) return;
    const allIds = getItemIds(summary.summary).filter(
      (id) => !summary.importedItemIds.includes(id)
    );
    if (selectedItems.size === allIds.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(allIds));
    }
  };

  const handleImport = async () => {
    if (selectedItems.size === 0 || !selectedAccountId) return;

    setImporting(true);
    try {
      const result = await importFileItems(
        fileId,
        Array.from(selectedItems).map((id) => ({ id })),
        {
          accountId: selectedAccountId,
        }
      );

      if (result.imported.length > 0) {
        showToast(
          `${result.imported.length} transacción(es) importada(s)`,
          'success'
        );
      }
      if (result.errors.length > 0) {
        showToast(`${result.errors.length} error(es) al importar`, 'error');
      }

      // Refresh the summary
      const updatedSummary = await getFileSummary(fileId);
      setSummary(updatedSummary);
      setSelectedItems(new Set());

      if (onImportComplete) {
        onImportComplete();
      }
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Error al importar',
        'error'
      );
    } finally {
      setImporting(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-800 rounded w-1/3"></div>
          <div className="h-4 bg-gray-800 rounded w-2/3"></div>
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 bg-gray-800 rounded"></div>
            ))}
          </div>
        </div>
        <p className="text-gray-400 text-center mt-4">
          Procesando archivo...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6">
        <div className="text-center">
          <div className="text-4xl mb-3">❌</div>
          <p className="text-red-400">{error}</p>
          {onClose && (
            <button
              onClick={onClose}
              className="mt-4 px-4 py-2 text-sm font-medium text-gray-300 bg-gray-800 border border-gray-700 rounded-xl hover:bg-gray-700 transition-all"
            >
              Cerrar
            </button>
          )}
        </div>
      </div>
    );
  }

  if (!summary) return null;

  const summaryIsReceipt = isReceipt(summary.summary);
  const summaryIsBankStatement = isBankStatement(summary.summary);
  const allItemIds = getItemIds(summary.summary).filter(
    (id) => !summary.importedItemIds.includes(id)
  );
  const allImported = allItemIds.length === 0;

  return (
    <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <span>{summaryIsReceipt ? '🧾' : '🏦'}</span>
          {filename}
        </h3>
        <span className="text-xs px-2 py-1 rounded-full bg-gray-700 text-gray-300">
          {summary.documentType === 'receipt' ? 'Recibo' : summary.documentType === 'invoice' ? 'Factura' : 'Estado de cuenta'}
        </span>
      </div>

      {/* Document info */}
      {summaryIsReceipt && isReceipt(summary.summary) ? (
        <div className="bg-gray-800 rounded-xl p-4 mb-4">
          <p className="text-white font-medium">
            {summary.summary.mainTransaction.merchant}
          </p>
          <p className="text-gray-400 text-sm">
            {summary.summary.mainTransaction.date || 'Fecha no detectada'}
          </p>
          <p className="text-2xl font-bold text-white mt-2">
            {formatCents(summary.summary.mainTransaction.amount * 100)}
          </p>
        </div>
      ) : isBankStatement(summary.summary) ? (
        <div className="bg-gray-800 rounded-xl p-4 mb-4">
          {summary.summary.accountName && (
            <p className="text-white font-medium">
              {summary.summary.accountName}
            </p>
          )}
          {summary.summary.period && (
            <p className="text-gray-400 text-sm">
              Período: {summary.summary.period.from} - {summary.summary.period.to}
            </p>
          )}
          <p className="text-gray-400 text-sm mt-1">
            {summary.summary.transactions.length} transacciones encontradas
          </p>
        </div>
      ) : null}

      {/* Transactions list */}
      {summaryIsBankStatement && isBankStatement(summary.summary) && summary.summary.transactions.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <button
              onClick={toggleAll}
              disabled={allImported}
              className="text-sm text-cyan-400 hover:text-cyan-300 disabled:text-gray-600"
            >
              {selectedItems.size === allItemIds.length
                ? 'Deseleccionar todo'
                : 'Seleccionar todo'}
            </button>
          </div>
          <div className="max-h-64 overflow-y-auto space-y-1">
            {summary.summary.transactions.map((tx) => {
              const isImported = summary.importedItemIds.includes(tx.id);
              return (
                <label
                  key={tx.id}
                  className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all ${
                    isImported
                      ? 'bg-gray-800/50 opacity-50'
                      : selectedItems.has(tx.id)
                      ? 'bg-cyan-500/10 border border-cyan-500/30'
                      : 'bg-gray-800 hover:bg-gray-700'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedItems.has(tx.id)}
                    onChange={() => toggleItem(tx.id)}
                    disabled={isImported}
                    className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-cyan-500 focus:ring-cyan-500"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm truncate">
                      {tx.description}
                    </p>
                    <p className="text-gray-500 text-xs">{tx.date || '-'}</p>
                  </div>
                  <span
                    className={`font-medium ${
                      tx.isCredit ? 'text-green-400' : 'text-red-400'
                    }`}
                  >
                    {tx.isCredit ? '+' : '-'}
                    {formatCents(Math.abs(tx.amount) * 100)}
                  </span>
                  {isImported && (
                    <span className="text-xs text-gray-500">Importado</span>
                  )}
                </label>
              );
            })}
          </div>
        </div>
      )}

      {/* Receipt single item */}
      {summaryIsReceipt && isReceipt(summary.summary) && !allImported && (
        <label
          className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all mb-4 ${
            selectedItems.has('main')
              ? 'bg-cyan-500/10 border border-cyan-500/30'
              : 'bg-gray-800 hover:bg-gray-700'
          }`}
        >
          <input
            type="checkbox"
            checked={selectedItems.has('main')}
            onChange={() => toggleItem('main')}
            className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-cyan-500 focus:ring-cyan-500"
          />
          <div className="flex-1">
            <p className="text-white text-sm">
              {summary.summary.mainTransaction.merchant}
            </p>
            <p className="text-gray-500 text-xs">
              {summary.summary.mainTransaction.date || 'Fecha no detectada'}
            </p>
          </div>
          <span className="font-medium text-red-400">
            -{formatCents(summary.summary.mainTransaction.amount * 100)}
          </span>
        </label>
      )}

      {/* Account selector */}
      {!allImported && accounts.length > 0 && (
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-300 mb-1">
            Cuenta destino
          </label>
          <select
            value={selectedAccountId}
            onChange={(e) => setSelectedAccountId(e.target.value)}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
          >
            {accounts.map((acc) => (
              <option key={acc.id} value={acc.id}>
                {acc.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-3">
        {onClose && (
          <button
            onClick={onClose}
            disabled={importing}
            className="px-4 py-2 text-sm font-medium text-gray-300 bg-gray-800 border border-gray-700 rounded-xl hover:bg-gray-700 disabled:opacity-50 transition-all"
          >
            Cerrar
          </button>
        )}
        {!allImported && (
          <button
            onClick={handleImport}
            disabled={selectedItems.size === 0 || importing || !selectedAccountId}
            className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-green-500 to-emerald-500 rounded-xl hover:from-green-600 hover:to-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {importing
              ? 'Importando...'
              : `Importar ${selectedItems.size} transacción(es)`}
          </button>
        )}
        {allImported && (
          <span className="text-green-400 text-sm flex items-center gap-1">
            ✓ Todo importado
          </span>
        )}
      </div>
    </div>
  );
}
