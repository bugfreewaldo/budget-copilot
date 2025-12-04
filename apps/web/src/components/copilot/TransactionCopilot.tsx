'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@budget-copilot/ui/button';
import {
  sendCopilotMessage,
  updateCopilotTransactionCategory,
  formatCents,
  type ChatMessage,
  type CopilotResponse,
} from '@/lib/api';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  transaction?: CopilotResponse['transaction'];
  transactionId?: string;
  suggestedCategories?: CopilotResponse['suggestedCategories'];
}

interface TransactionCopilotProps {
  onTransactionCreated?: () => void;
}

export function TransactionCopilot({ onTransactionCreated }: TransactionCopilotProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: 'Hola! Soy tu copiloto de presupuesto. Cuéntame tus gastos y los registraré por ti. Por ejemplo: "Gasté $50 en ropa en Nike"',
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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
      const response = await sendCopilotMessage(userMessage, conversationHistory);

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

  const handleCategoryChange = async (transactionId: string, categoryId: string) => {
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
                {msg.suggestedCategories && msg.suggestedCategories.length > 0 && msg.transactionId && (
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
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="Escribe tu gasto..."
              className="flex-1 px-4 py-2 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 text-sm"
              disabled={isLoading}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
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
