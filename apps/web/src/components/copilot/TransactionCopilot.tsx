'use client';

import { useState, useRef, useEffect } from 'react';
import {
  sendCopilotMessage,
  updateCopilotTransactionCategory,
  formatCents,
  createUploadUrls,
  completeUpload,
  uploadFileToS3,
  getFileSummary,
  importFileItems,
  getAccounts,
  getCategories,
  type ChatMessage,
  type CopilotResponse,
  type FileSummaryResponse,
  type Account,
  type Category,
  type ImportItem,
} from '@/lib/api';

interface ParsedFileData {
  fileId: string;
  filename: string;
  summary: FileSummaryResponse | null;
  status: 'uploading' | 'processing' | 'ready' | 'error';
  error?: string;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  transaction?: CopilotResponse['transaction'];
  transactionId?: string;
  suggestedCategories?: CopilotResponse['suggestedCategories'];
  // File upload data
  parsedFile?: ParsedFileData;
  isFileMessage?: boolean;
}

interface TransactionCopilotProps {
  onTransactionCreated?: () => void;
}

export function TransactionCopilot({
  onTransactionCreated,
}: TransactionCopilotProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content:
        '¡Hola! 👋 Soy tu asistente financiero. Puedes contarme tus gastos con texto o subir una foto de un recibo usando el ícono de cámara 📷. ¡Empecemos!',
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  // Track selected category per transaction: { [fileId_txId]: categoryId }
  const [selectedCategories, setSelectedCategories] = useState<Record<string, string>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load accounts and categories on mount
  useEffect(() => {
    getAccounts().then(setAccounts).catch(() => setAccounts([]));
    getCategories().then(setCategories).catch(() => setCategories([]));
  }, []);

  // Auto-scroll to bottom when new messages appear
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when expanded
  useEffect(() => {
    if (isExpanded) {
      inputRef.current?.focus();
    }
  }, [isExpanded]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');

    // Add user message
    const userMsgId = Date.now().toString();
    setMessages((prev) => [
      ...prev,
      { id: userMsgId, role: 'user', content: userMessage },
    ]);

    setIsLoading(true);

    try {
      // Build conversation history
      const conversationHistory: ChatMessage[] = messages
        .filter((m) => m.role !== 'assistant' || m.id !== '1') // Exclude initial greeting
        .map((m) => ({
          role: m.role,
          content: m.content,
        }));

      // Send to API
      const response = await sendCopilotMessage(
        userMessage,
        conversationHistory
      );

      // Add assistant response
      const assistantMsgId = (Date.now() + 1).toString();
      setMessages((prev) => [
        ...prev,
        {
          id: assistantMsgId,
          role: 'assistant',
          content: response.message,
          transaction: response.transaction,
          transactionId: response.transactionId,
          suggestedCategories: response.suggestedCategories,
        },
      ]);

      // Notify parent if transaction was created
      if (response.transactionCreated && onTransactionCreated) {
        onTransactionCreated();
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: 'Lo siento, hubo un error. Por favor intenta de nuevo.',
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCategoryChange = async (
    transactionId: string,
    categoryId: string
  ) => {
    try {
      await updateCopilotTransactionCategory(transactionId, categoryId);
      setMessages((prev) =>
        prev.map((msg) =>
          msg.transactionId === transactionId
            ? {
                ...msg,
                content: msg.content + ' (Categoría actualizada)',
                suggestedCategories: undefined,
              }
            : msg
        )
      );
    } catch (error) {
      console.error('Failed to update category:', error);
    }
  };

  // Handle file upload
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input so same file can be selected again
    e.target.value = '';

    // Validate file type
    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/heic',
      'application/pdf',
    ];
    if (!allowedTypes.includes(file.type)) {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: 'assistant',
          content: 'Solo puedo procesar imágenes (JPG, PNG, WebP) y PDFs.',
        },
      ]);
      return;
    }

    // Add user message with file
    const userMsgId = Date.now().toString();
    setMessages((prev) => [
      ...prev,
      {
        id: userMsgId,
        role: 'user',
        content: `📎 ${file.name}`,
        isFileMessage: true,
      },
    ]);

    setIsUploading(true);

    // Add assistant message for upload status
    const assistantMsgId = (Date.now() + 1).toString();
    setMessages((prev) => [
      ...prev,
      {
        id: assistantMsgId,
        role: 'assistant',
        content: 'Procesando archivo...',
        parsedFile: {
          fileId: '',
          filename: file.name,
          summary: null,
          status: 'uploading',
        },
      },
    ]);

    try {
      // Get pre-signed URL
      const { uploadTargets } = await createUploadUrls([
        { filename: file.name, mimeType: file.type, size: file.size },
      ]);

      const target = uploadTargets[0]!;

      // Upload to S3
      await uploadFileToS3(file, target.uploadUrl);

      // Update status to processing
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMsgId
            ? {
                ...msg,
                content: 'Analizando contenido...',
                parsedFile: {
                  ...msg.parsedFile!,
                  status: 'processing',
                },
              }
            : msg
        )
      );

      // Complete upload
      const result = await completeUpload([
        {
          storageKey: target.storageKey,
          originalName: file.name,
          mimeType: file.type,
          size: file.size,
        },
      ]);

      const fileId = result.fileIds[0]!;

      // If it was parsed immediately (image), get summary
      if (result.parsed.includes(fileId)) {
        const summary = await getFileSummary(fileId);
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMsgId
              ? {
                  ...msg,
                  content: getFileResultMessage(summary),
                  parsedFile: {
                    fileId,
                    filename: file.name,
                    summary,
                    status: 'ready',
                  },
                }
              : msg
          )
        );
      } else {
        // PDF/Excel - poll for results
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMsgId
              ? {
                  ...msg,
                  parsedFile: {
                    ...msg.parsedFile!,
                    fileId,
                    status: 'processing',
                  },
                }
              : msg
          )
        );
        pollForSummary(assistantMsgId, fileId, file.name);
      }
    } catch (error) {
      console.error('File upload failed:', error);
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMsgId
            ? {
                ...msg,
                content: 'Error al procesar el archivo. Intenta de nuevo.',
                parsedFile: {
                  ...msg.parsedFile!,
                  status: 'error',
                  error:
                    error instanceof Error ? error.message : 'Error desconocido',
                },
              }
            : msg
        )
      );
    } finally {
      setIsUploading(false);
    }
  };

  // Poll for file summary (for PDFs processed by cron)
  const pollForSummary = async (
    messageId: string,
    fileId: string,
    filename: string
  ) => {
    const maxAttempts = 30; // 90 seconds max
    let attempts = 0;

    const poll = async () => {
      attempts++;
      try {
        const summary = await getFileSummary(fileId);
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === messageId
              ? {
                  ...msg,
                  content: getFileResultMessage(summary),
                  parsedFile: {
                    fileId,
                    filename,
                    summary,
                    status: 'ready',
                  },
                }
              : msg
          )
        );
      } catch {
        if (attempts < maxAttempts) {
          setTimeout(poll, 3000);
        } else {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === messageId
                ? {
                    ...msg,
                    content:
                      'El archivo sigue procesándose. Revisa más tarde en tus archivos.',
                    parsedFile: {
                      fileId,
                      filename,
                      summary: null,
                      status: 'processing',
                    },
                  }
                : msg
            )
          );
        }
      }
    };

    setTimeout(poll, 3000);
  };

  // Generate message for file result
  const getFileResultMessage = (summary: FileSummaryResponse): string => {
    if (summary.summary.documentType === 'receipt' || summary.summary.documentType === 'invoice') {
      const { merchant, amount } = summary.summary.mainTransaction;
      return `Encontré un recibo de ${merchant} por ${formatCents(amount * 100)}. ¿Quieres importarlo?`;
    } else {
      const count = summary.summary.transactions.length;
      return `Encontré ${count} transacción${count !== 1 ? 'es' : ''} en el documento. Selecciona las que quieras importar.`;
    }
  };

  // Import transactions from parsed file
  const handleImportFromFile = async (
    messageId: string,
    fileId: string,
    itemIds: string[]
  ) => {
    if (itemIds.length === 0 || accounts.length === 0) return;

    // Build items array with selected categories
    const items: ImportItem[] = itemIds.map((id) => ({
      id,
      categoryId: selectedCategories[`${fileId}_${id}`],
    }));

    try {
      const result = await importFileItems(fileId, items, {
        accountId: accounts[0]!.id,
      });

      if (result.imported.length > 0) {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === messageId
              ? {
                  ...msg,
                  content: `✅ ${result.imported.length} transacción${result.imported.length !== 1 ? 'es' : ''} importada${result.imported.length !== 1 ? 's' : ''} correctamente!`,
                  parsedFile: undefined,
                }
              : msg
          )
        );
        if (onTransactionCreated) {
          onTransactionCreated();
        }
      }
    } catch (error) {
      console.error('Import failed:', error);
    }
  };

  // Handle category selection for a transaction
  const handleCategorySelect = (fileId: string, txId: string, categoryId: string) => {
    setSelectedCategories((prev) => ({
      ...prev,
      [`${fileId}_${txId}`]: categoryId,
    }));
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const quickExamples = [
    'Gasté $30 en almuerzo',
    '$50 de Uber',
    'Compré ropa por $150',
  ];

  // Collapsed state - floating button
  if (!isExpanded) {
    return (
      <div className="fixed bottom-20 sm:bottom-6 right-4 sm:right-6 z-50">
        <button
          onClick={() => setIsExpanded(true)}
          className="flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-600 hover:to-purple-600 text-white rounded-full shadow-lg shadow-cyan-500/25 transition-all hover:scale-105"
        >
          <span className="text-xl">🧠</span>
          <span className="font-medium">Budget Copilot</span>
        </button>
      </div>
    );
  }

  // Expanded chat interface
  return (
    <div className="fixed bottom-0 left-0 right-0 sm:bottom-6 sm:left-auto sm:right-6 z-50 sm:w-96 sm:max-w-[calc(100vw-3rem)]">
      <div className="bg-gray-900/95 backdrop-blur-xl sm:rounded-2xl border-t sm:border border-gray-800 shadow-2xl shadow-black/50 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 bg-gradient-to-r from-cyan-500/10 to-purple-500/10">
          <div className="flex items-center gap-2">
            <span className="text-xl">🤖</span>
            <span className="font-semibold text-white">Budget Copilot</span>
          </div>
          <button
            onClick={() => setIsExpanded(false)}
            className="p-1 text-gray-400 hover:text-white transition-colors"
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

        {/* Messages */}
        <div className="h-80 overflow-y-auto p-4 space-y-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${
                msg.role === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2 ${
                  msg.role === 'user'
                    ? 'bg-gradient-to-r from-cyan-500 to-purple-500 text-white'
                    : 'bg-gray-800 text-gray-100'
                }`}
              >
                <p className="text-sm">{msg.content}</p>

                {/* Show transaction details if created */}
                {msg.transaction && (
                  <div className="mt-2 pt-2 border-t border-gray-700/50">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-green-400">✓</span>
                      <span>
                        {formatCents(Math.abs(msg.transaction.amountCents))} -{' '}
                        {msg.transaction.description}
                      </span>
                    </div>
                    {msg.transaction.categoryName && (
                      <div className="text-xs text-gray-400 mt-1">
                        Categoría: {msg.transaction.categoryName}
                      </div>
                    )}
                  </div>
                )}

                {/* Show category suggestions */}
                {msg.suggestedCategories &&
                  msg.suggestedCategories.length > 0 &&
                  msg.transactionId && (
                    <div className="mt-2 pt-2 border-t border-gray-700/50">
                      <p className="text-xs text-gray-400 mb-2">
                        ¿Cambiar categoría?
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {msg.suggestedCategories.map((cat) => (
                          <button
                            key={cat.id}
                            onClick={() =>
                              handleCategoryChange(msg.transactionId!, cat.id)
                            }
                            className="text-xs px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded-full transition-colors"
                          >
                            {cat.emoji} {cat.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                {/* Show parsed file data with import options */}
                {msg.parsedFile && msg.parsedFile.status === 'ready' && msg.parsedFile.summary && (
                  <div className="mt-2 pt-2 border-t border-gray-700/50">
                    {msg.parsedFile.summary.summary.documentType === 'receipt' || msg.parsedFile.summary.summary.documentType === 'invoice' ? (
                      // Receipt - single import button
                      <button
                        onClick={() =>
                          handleImportFromFile(
                            msg.id,
                            msg.parsedFile!.fileId,
                            ['main']
                          )
                        }
                        className="w-full text-xs px-3 py-2 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded-lg transition-colors"
                      >
                        ✓ Importar gasto
                      </button>
                    ) : (
                      // Bank statement - list transactions with category selection
                      <div className="space-y-2">
                        <p className="text-xs text-gray-400 mb-2">
                          Selecciona categoría e importa:
                        </p>
                        <div className="max-h-64 overflow-y-auto space-y-2">
                          {msg.parsedFile.summary.summary.transactions.map((tx) => {
                            const fileId = msg.parsedFile!.fileId;
                            const selectedCatId = selectedCategories[`${fileId}_${tx.id}`];
                            const selectedCat = categories.find(c => c.id === selectedCatId);

                            return (
                              <div
                                key={tx.id}
                                className="bg-gray-700/50 rounded-lg p-2 space-y-1.5"
                              >
                                {/* Transaction info */}
                                <div className="flex items-center justify-between text-xs">
                                  <span className="truncate flex-1 text-left font-medium">
                                    {tx.description}
                                  </span>
                                  <span
                                    className={`ml-2 font-semibold ${
                                      tx.isCredit
                                        ? 'text-green-400'
                                        : 'text-red-400'
                                    }`}
                                  >
                                    {tx.isCredit ? '+' : '-'}
                                    {formatCents(Math.abs(tx.amount) * 100)}
                                  </span>
                                </div>

                                {/* Category selector + Import button */}
                                <div className="flex items-center gap-1.5">
                                  <select
                                    value={selectedCatId || ''}
                                    onChange={(e) => handleCategorySelect(fileId, tx.id, e.target.value)}
                                    className="flex-1 text-xs px-2 py-1 bg-gray-800 border border-gray-600 rounded text-white focus:outline-none focus:border-cyan-500"
                                  >
                                    <option value="">Sin categoría</option>
                                    {categories.map((cat) => (
                                      <option key={cat.id} value={cat.id}>
                                        {cat.emoji} {cat.name}
                                      </option>
                                    ))}
                                  </select>
                                  <button
                                    onClick={() =>
                                      handleImportFromFile(
                                        msg.id,
                                        fileId,
                                        [tx.id]
                                      )
                                    }
                                    className="text-xs px-2 py-1 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded transition-colors whitespace-nowrap"
                                  >
                                    {selectedCat ? `${selectedCat.emoji}` : '+'} Importar
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        {msg.parsedFile.summary.summary.transactions.length > 1 && (
                          <button
                            onClick={() =>
                              handleImportFromFile(
                                msg.id,
                                msg.parsedFile!.fileId,
                                msg.parsedFile!.summary!.summary.documentType === 'bank_statement'
                                  ? msg.parsedFile!.summary!.summary.transactions.map(
                                      (t) => t.id
                                    )
                                  : ['main']
                              )
                            }
                            className="w-full text-xs px-3 py-2 mt-2 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 rounded-lg transition-colors"
                          >
                            Importar todas ({msg.parsedFile.summary.summary.transactions.length})
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Show loading state for file processing */}
                {msg.parsedFile && (msg.parsedFile.status === 'uploading' || msg.parsedFile.status === 'processing') && (
                  <div className="mt-2 pt-2 border-t border-gray-700/50">
                    <div className="flex items-center gap-2 text-xs text-gray-400">
                      <div className="w-3 h-3 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                      <span>
                        {msg.parsedFile.status === 'uploading'
                          ? 'Subiendo...'
                          : 'Analizando...'}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Loading indicator */}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-gray-800 rounded-2xl px-4 py-2">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" />
                  <div
                    className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce"
                    style={{ animationDelay: '0.1s' }}
                  />
                  <div
                    className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce"
                    style={{ animationDelay: '0.2s' }}
                  />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick examples */}
        {messages.length <= 2 && (
          <div className="px-4 py-2 border-t border-gray-800">
            <p className="text-xs text-gray-500 mb-2">Ejemplos rápidos:</p>
            <div className="flex flex-wrap gap-2">
              {quickExamples.map((example) => (
                <button
                  key={example}
                  onClick={() => setInput(example)}
                  className="text-xs px-3 py-1 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-full transition-colors"
                >
                  {example}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input */}
        <div className="p-4 border-t border-gray-800">
          <div className="flex items-center gap-2">
            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic,application/pdf"
              onChange={handleFileSelect}
              className="hidden"
            />
            {/* Upload button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading || isUploading}
              className="p-2 text-gray-400 hover:text-cyan-400 disabled:text-gray-600 transition-colors"
              title="Subir foto o PDF"
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
                  d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            </button>
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="Escribe tu gasto..."
              className="flex-1 px-4 py-2 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 text-sm"
              disabled={isLoading || isUploading}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isLoading || isUploading}
              className="p-2 bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-600 hover:to-purple-600 disabled:from-gray-600 disabled:to-gray-600 rounded-xl transition-all"
            >
              <svg
                className="w-5 h-5 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
