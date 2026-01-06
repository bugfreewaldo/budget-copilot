'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@budget-copilot/ui/button';
import {
  sendAdvisorMessage,
  confirmAdvisorChanges,
  resetAdvisorSession,
  createUploadUrls,
  uploadFileToS3,
  completeUpload,
  getFileSummary,
  getCategories,
  type AdvisorMessage,
  type AdvisorPendingChanges,
  type AdvisorDocumentContext,
  type Category,
} from '@/lib/api';
import { useToast } from '@/components/ui/toast';
import { ImportModeSelector } from './ImportModeSelector';
import { ImportPreviewModal } from './ImportPreviewModal';
import { InsightsPanel } from './InsightsPanel';
import { ImportStagingCard } from './ImportStagingCard';

type EnrichedTransaction = NonNullable<
  AdvisorDocumentContext['enrichment']
>['transactions'][number];

type ImportMode = 'none' | 'mode-select' | 'insights' | 'preview' | 'staging';

interface AdvisorChatProps {
  sessionId: string;
  initialHistory: AdvisorMessage[];
  initialPendingChanges: AdvisorPendingChanges | null;
  onDecisionUpdated: () => void;
}

/**
 * AdvisorChat Component
 *
 * Chat interface with file upload and pending changes confirmation.
 * Key UX: Changes are proposed, user confirms, then committed.
 */
export function AdvisorChat({
  sessionId,
  initialHistory,
  initialPendingChanges,
  onDecisionUpdated,
}: AdvisorChatProps) {
  const { showToast } = useToast();
  const [messages, setMessages] = useState<AdvisorMessage[]>(initialHistory);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [pendingChanges, setPendingChanges] =
    useState<AdvisorPendingChanges | null>(initialPendingChanges);
  const [confirmationPrompt, setConfirmationPrompt] = useState<string | null>(
    null
  );
  const [isUploading, setIsUploading] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);

  // Import pipeline state
  const [importMode, setImportMode] = useState<ImportMode>('none');
  const [documentContext, setDocumentContext] =
    useState<AdvisorDocumentContext | null>(null);
  const [stagedTransactions, setStagedTransactions] = useState<
    EnrichedTransaction[]
  >([]);
  const [categories, setCategories] = useState<Category[]>([]);

  // Reset state
  const [isResetting, setIsResetting] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, pendingChanges]);

  // Focus input on load
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Fetch categories on mount for category picker
  useEffect(() => {
    getCategories()
      .then(setCategories)
      .catch((err) => console.error('Failed to load categories:', err));
  }, []);

  const handleSendMessage = async (directMessage?: string) => {
    const messageToSend = directMessage || input.trim();
    if (!messageToSend || isLoading) return;

    const userMessage = messageToSend;
    setInput('');
    setIsLoading(true);

    // Add user message to UI immediately
    const tempUserMessage: AdvisorMessage = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content: userMessage,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, tempUserMessage]);

    try {
      const response = await sendAdvisorMessage(sessionId, userMessage);

      // Add assistant message
      const assistantMessage: AdvisorMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: response.reply,
        timestamp: Date.now(),
        classification: response.classification,
        hasPendingChanges: response.pendingChanges !== null,
      };
      setMessages((prev) => [...prev, assistantMessage]);

      // Update pending changes if any
      if (response.pendingChanges) {
        setPendingChanges(response.pendingChanges);
        setConfirmationPrompt(response.confirmationPrompt);
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      showToast('Error al enviar mensaje. Intenta de nuevo.', 'error');
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleConfirmChanges = async () => {
    if (!pendingChanges || isConfirming) return;

    setIsConfirming(true);

    try {
      const result = await confirmAdvisorChanges(sessionId);

      if (result.success) {
        showToast(result.message, 'success');
        setPendingChanges(null);
        setConfirmationPrompt(null);

        if (result.decisionRecomputed && result.redirectTo) {
          onDecisionUpdated();
        }
      } else {
        showToast(result.message || 'Error al aplicar cambios', 'error');
      }
    } catch (error) {
      console.error('Failed to confirm changes:', error);
      showToast('Error al aplicar cambios. Intenta de nuevo.', 'error');
    } finally {
      setIsConfirming(false);
    }
  };

  const handleCancelChanges = () => {
    setPendingChanges(null);
    setConfirmationPrompt(null);
    showToast('Cambios descartados', 'info');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleFileUpload = async (file: File) => {
    setIsUploading(true);
    try {
      // 1. Get presigned URL
      const { uploadTargets } = await createUploadUrls([
        {
          filename: file.name,
          mimeType: file.type,
          size: file.size,
        },
      ]);
      const target = uploadTargets[0];
      if (!target) throw new Error('No upload target returned');

      // 2. Upload to S3
      await uploadFileToS3(file, target.uploadUrl);

      // 3. Complete upload
      const result = await completeUpload([
        {
          storageKey: target.storageKey,
          originalName: file.name,
          mimeType: file.type,
          size: file.size,
        },
      ]);

      const fileId = result.fileIds[0];
      if (!fileId) throw new Error('No file ID returned');

      // Check if file parsing failed
      if (result.failed && result.failed.includes(fileId)) {
        throw new Error(
          'No se pudo procesar el archivo. Verifica que sea un formato valido (imagen, PDF, Excel o CSV).'
        );
      }

      // 4. Get parsed summary
      const summaryData = await getFileSummary(fileId);

      // 5. Auto-send to advisor
      setIsUploading(false);
      setIsLoading(true);

      const fileContext = {
        fileId,
        summary: JSON.stringify(summaryData.summary),
      };

      // Add user message to UI
      const tempUserMessage: AdvisorMessage = {
        id: `temp-${Date.now()}`,
        role: 'user',
        content: `[Archivo: ${file.name}]`,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, tempUserMessage]);

      // Send to advisor
      const response = await sendAdvisorMessage(sessionId, '', fileContext);

      // Add assistant message
      const assistantMessage: AdvisorMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: response.reply,
        timestamp: Date.now(),
        classification: response.classification,
        hasPendingChanges: response.pendingChanges !== null,
      };
      setMessages((prev) => [...prev, assistantMessage]);

      // Handle document context and import flow
      if (response.showModeSelector && response.documentContext) {
        setDocumentContext(response.documentContext);
        setImportMode('mode-select');
      } else if (response.pendingChanges) {
        // Fallback to old behavior if no documentContext
        setPendingChanges(response.pendingChanges);
        setConfirmationPrompt(response.confirmationPrompt);
      }
    } catch (error) {
      console.error('File upload error:', error);
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Error al subir archivo. Intenta de nuevo.';
      showToast(errorMessage, 'error');
    } finally {
      setIsUploading(false);
      setIsLoading(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragActive(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileUpload(file);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileUpload(file);
    // Reset input so the same file can be selected again
    e.target.value = '';
  };

  // ============================================================================
  // Import Mode Handlers
  // ============================================================================

  const handleAnalyzeOnly = useCallback(() => {
    setImportMode('insights');
  }, []);

  const handleReviewAndSelect = useCallback(() => {
    setImportMode('preview');
  }, []);

  const handleImportAll = useCallback(() => {
    if (!documentContext?.enrichment?.transactions) return;

    // Apply default filters: exclude transfers and micro-fees
    const filtered = documentContext.enrichment.transactions.filter((tx) => {
      if (tx.isTransfer) return false;
      if (Math.abs(tx.amount) < 1) return false;
      return true;
    });

    setStagedTransactions(filtered);
    setImportMode('staging');
  }, [documentContext]);

  const handleStageTransactions = useCallback(
    (transactions: EnrichedTransaction[]) => {
      setStagedTransactions(transactions);
      setImportMode('staging');
    },
    []
  );

  const handleCancelImport = useCallback(() => {
    setImportMode('none');
    setDocumentContext(null);
    setStagedTransactions([]);
    showToast('Importacion cancelada', 'info');
  }, [showToast]);

  const handleCloseInsights = useCallback(() => {
    setImportMode('none');
    setDocumentContext(null);
  }, []);

  const handleCategoryChange = useCallback(
    (
      transactionId: string,
      categoryId: string | null,
      categoryName: string | null
    ) => {
      setDocumentContext((prev) => {
        if (!prev?.enrichment?.transactions) return prev;

        const updatedTransactions = prev.enrichment.transactions.map((tx) => {
          if (tx.id === transactionId) {
            return {
              ...tx,
              category: {
                id: categoryId,
                name: categoryName,
                confidence: 1.0, // User-selected = full confidence
                source: 'pattern' as const, // Treat user selection like a confirmed pattern
              },
            };
          }
          return tx;
        });

        return {
          ...prev,
          enrichment: {
            ...prev.enrichment,
            transactions: updatedTransactions,
          },
        };
      });
    },
    []
  );

  const handleConfirmImport = useCallback(async () => {
    if (!documentContext || stagedTransactions.length === 0) return;

    setIsConfirming(true);

    try {
      // Build category overrides from staged transactions (only if user changed category)
      const categoryOverrides: Record<
        string,
        { categoryId: string | null; categoryName: string | null }
      > = {};
      for (const tx of stagedTransactions) {
        if (tx.category.id !== null) {
          categoryOverrides[tx.id] = {
            categoryId: tx.category.id,
            categoryName: tx.category.name,
          };
        }
      }

      // Build pending changes from staged transactions
      const changes: AdvisorPendingChanges = {
        fileImport: {
          fileId: documentContext.fileId,
          itemIds: stagedTransactions.map((tx) => tx.id),
          categoryOverrides:
            Object.keys(categoryOverrides).length > 0
              ? categoryOverrides
              : undefined,
        },
      };

      // Clear UI state
      setImportMode('none');
      setDocumentContext(null);
      setStagedTransactions([]);

      // Call confirm with changes passed directly
      const result = await confirmAdvisorChanges(sessionId, changes);

      if (result.success) {
        showToast(result.message, 'success');
        setPendingChanges(null);

        if (result.decisionRecomputed && result.redirectTo) {
          onDecisionUpdated();
        }
      } else {
        showToast(result.message || 'Error al importar transacciones', 'error');
      }
    } catch (error) {
      console.error('Failed to import transactions:', error);
      showToast('Error al importar transacciones. Intenta de nuevo.', 'error');
    } finally {
      setIsConfirming(false);
    }
  }, [
    documentContext,
    stagedTransactions,
    sessionId,
    showToast,
    onDecisionUpdated,
  ]);

  // ============================================================================
  // Reset Handler
  // ============================================================================

  const handleResetSession = useCallback(async () => {
    setIsResetting(true);
    setShowResetConfirm(false);

    try {
      const result = await resetAdvisorSession(sessionId);

      if (result.success) {
        // Clear all local state
        setMessages([]);
        setPendingChanges(null);
        setConfirmationPrompt(null);
        setImportMode('none');
        setDocumentContext(null);
        setStagedTransactions([]);
        setInput('');

        showToast('Conversacion reiniciada', 'success');
      } else {
        showToast(result.message || 'Error al reiniciar', 'error');
      }
    } catch (error) {
      console.error('Failed to reset session:', error);
      showToast('Error al reiniciar. Intenta de nuevo.', 'error');
    } finally {
      setIsResetting(false);
    }
  }, [sessionId, showToast]);

  return (
    <div className="flex flex-col h-[calc(100vh-200px)]">
      {/* File Upload Zone */}
      <div
        onClick={() => fileInputRef.current?.click()}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`border border-dashed rounded-xl p-4 mb-4 text-center transition-colors cursor-pointer ${
          isDragActive
            ? 'border-cyan-500 bg-cyan-500/10'
            : 'border-gray-700 hover:border-gray-600'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept="image/*,.pdf,.csv,.xlsx,.xls,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
          onChange={handleFileInputChange}
        />
        {isUploading ? (
          <p className="text-cyan-400 text-sm">Procesando archivo...</p>
        ) : (
          <p className="text-gray-500 text-sm">
            Arrastra aquí estados de cuenta, recibos, capturas o archivos.
            <br />
            <span className="text-gray-600 text-xs">
              PDF, Excel, CSV o imagen
            </span>
          </p>
        )}
      </div>

      {/* Quick Action Suggestions */}
      {messages.length === 0 && !isLoading && (
        <div className="mb-4">
          <p className="text-gray-500 text-xs mb-2">Acciones rápidas:</p>
          <div className="flex flex-wrap gap-2">
            {[
              {
                label: '💸 Registrar gasto',
                message: 'Quiero registrar un gasto',
              },
              {
                label: '💰 Registrar ingreso',
                message: 'Quiero registrar un ingreso',
              },
              {
                label: '🔄 Agregar gasto fijo',
                message: 'Quiero agregar un gasto fijo recurrente',
              },
              {
                label: '💀 Agregar deuda',
                message: 'Quiero agregar una deuda',
              },
              {
                label: '📊 Ver mi situación',
                message: '¿Cuál es mi situación financiera actual?',
              },
            ].map((action) => (
              <button
                key={action.label}
                onClick={() => handleSendMessage(action.message)}
                disabled={isLoading || isConfirming}
                className="px-3 py-1.5 text-xs bg-gray-800 border border-gray-700 rounded-full text-gray-300 hover:bg-gray-700 hover:text-white hover:border-gray-600 transition-all disabled:opacity-50"
              >
                {action.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto space-y-4 mb-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                msg.role === 'user'
                  ? 'bg-cyan-600 text-white'
                  : 'bg-gray-800 text-gray-100'
              }`}
            >
              <p className="whitespace-pre-wrap text-sm leading-relaxed">
                {msg.content}
              </p>
            </div>
          </div>
        ))}

        {/* Loading indicator */}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-800 rounded-2xl px-4 py-3">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" />
                <span
                  className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"
                  style={{ animationDelay: '0.1s' }}
                />
                <span
                  className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"
                  style={{ animationDelay: '0.2s' }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Import Mode Selector */}
        {importMode === 'mode-select' && documentContext && (
          <div className="mx-2">
            <ImportModeSelector
              documentContext={documentContext}
              onAnalyzeOnly={handleAnalyzeOnly}
              onReviewAndSelect={handleReviewAndSelect}
              onImportAll={handleImportAll}
            />
          </div>
        )}

        {/* Insights Panel */}
        {importMode === 'insights' && documentContext && (
          <div className="mx-2">
            <InsightsPanel
              documentContext={documentContext}
              onClose={handleCloseInsights}
            />
          </div>
        )}

        {/* Import Staging Card */}
        {importMode === 'staging' && documentContext && (
          <div className="mx-2">
            <ImportStagingCard
              selectedTransactions={stagedTransactions}
              originalStats={{
                totalCount: documentContext.stats.totalCount,
                transferCount: documentContext.stats.transferCount,
                microFeeCount: documentContext.stats.microFeeCount,
              }}
              isLoading={isConfirming}
              onCancel={handleCancelImport}
              onConfirm={handleConfirmImport}
            />
          </div>
        )}

        {/* Pending Changes Card */}
        {pendingChanges && (
          <div className="bg-gray-900 border border-cyan-500/30 rounded-xl p-4 mx-2">
            <h3 className="text-cyan-400 font-medium mb-3">Propuesta</h3>

            {/* Summary of changes */}
            <div className="text-gray-300 text-sm space-y-1 mb-4">
              {renderPendingChangesSummary(pendingChanges)}
            </div>

            {/* Confirmation prompt */}
            {confirmationPrompt && (
              <p className="text-gray-400 text-sm mb-4">{confirmationPrompt}</p>
            )}

            {/* Action buttons */}
            <div className="flex gap-3">
              <Button
                onClick={handleConfirmChanges}
                disabled={isConfirming}
                className="flex-1 bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-600 hover:to-purple-600"
              >
                {isConfirming ? 'Aplicando...' : 'Aplicar cambios'}
              </Button>
              <Button
                variant="outline"
                onClick={handleCancelChanges}
                disabled={isConfirming}
                className="flex-1"
              >
                Cancelar
              </Button>
            </div>

            {/* Microcopy */}
            <p className="text-gray-500 text-xs mt-3 text-center">
              Aplicar cambios puede recalcular la decisión de hoy.
            </p>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="border-t border-gray-800 pt-4">
        <div className="flex gap-3">
          {/* Reset button */}
          <button
            onClick={() => setShowResetConfirm(true)}
            disabled={
              isLoading || isConfirming || isResetting || messages.length === 0
            }
            className="p-3 text-gray-500 hover:text-gray-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="Reiniciar conversacion"
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
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          </button>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Escribe tu mensaje..."
            disabled={isLoading || isConfirming || isResetting}
            className="flex-1 px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 disabled:opacity-50 transition-all"
          />
          <Button
            onClick={() => handleSendMessage()}
            disabled={!input.trim() || isLoading || isConfirming || isResetting}
            className="px-6"
          >
            Enviar
          </Button>
        </div>
      </div>

      {/* Reset Confirmation Modal */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 max-w-sm mx-4">
            <h3 className="text-white font-medium mb-2">
              Reiniciar conversacion
            </h3>
            <p className="text-gray-400 text-sm mb-4">
              Esto borrara todo el historial de la conversacion actual. Esta
              accion no se puede deshacer.
            </p>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setShowResetConfirm(false)}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                variant="danger"
                onClick={handleResetSession}
                disabled={isResetting}
                className="flex-1"
              >
                {isResetting ? 'Reiniciando...' : 'Reiniciar'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Import Preview Modal (Full-screen) */}
      {importMode === 'preview' && documentContext && (
        <ImportPreviewModal
          documentContext={documentContext}
          categories={categories}
          onClose={handleCancelImport}
          onStage={handleStageTransactions}
          onCategoryChange={handleCategoryChange}
        />
      )}
    </div>
  );
}

/**
 * Render a summary of pending changes
 * Note: pendingChanges comes from AI and may not match expected types exactly
 */
function renderPendingChangesSummary(
  changes: AdvisorPendingChanges
): React.ReactNode {
  const items: string[] = [];

  // Defensive: check if transactions is actually an array
  if (Array.isArray(changes.transactions)) {
    for (const txn of changes.transactions) {
      if (txn && typeof txn === 'object') {
        const sign = txn.type === 'expense' ? '-' : '+';
        const amount =
          typeof txn.amountCents === 'number'
            ? (txn.amountCents / 100).toFixed(2)
            : '?';
        items.push(`${txn.description || 'Transacción'}: ${sign}$${amount}`);
      }
    }
  }

  if (changes.incomeChange && typeof changes.incomeChange === 'object') {
    const amount =
      typeof changes.incomeChange.amountCents === 'number'
        ? (changes.incomeChange.amountCents / 100).toFixed(2)
        : '?';
    items.push(`Ingreso mensual: $${amount}`);
  }

  // Defensive: check if debtChanges is actually an array
  if (Array.isArray(changes.debtChanges)) {
    for (const debt of changes.debtChanges) {
      if (debt && typeof debt === 'object' && debt.name) {
        const balance =
          typeof debt.currentBalanceCents === 'number'
            ? ` $${(debt.currentBalanceCents / 100).toFixed(2)}`
            : '';
        items.push(`Deuda: ${debt.name}${balance}`);
      }
    }
  }

  // Defensive: check if billChanges is actually an array
  if (Array.isArray(changes.billChanges)) {
    for (const bill of changes.billChanges) {
      if (bill && typeof bill === 'object' && bill.name) {
        const amount =
          typeof bill.amountCents === 'number'
            ? ` $${(bill.amountCents / 100).toFixed(2)}/mes`
            : '';
        items.push(`Gasto fijo: ${bill.name}${amount}`);
      }
    }
  }

  // Defensive: check if transactionDeletions is actually an array
  if (
    Array.isArray(changes.transactionDeletions) &&
    changes.transactionDeletions.length > 0
  ) {
    items.push(
      `${changes.transactionDeletions.length} transacción(es) a disputar`
    );
  }

  if (
    changes.fileImport &&
    typeof changes.fileImport === 'object' &&
    Array.isArray(changes.fileImport.itemIds)
  ) {
    items.push(
      `${changes.fileImport.itemIds.length} transacciones del archivo`
    );
  }

  if (items.length === 0) {
    items.push('Cambios propuestos');
  }

  return items.map((item, i) => <div key={i}>{item}</div>);
}
