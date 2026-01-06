'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useInterview } from '@/lib/hooks';
import {
  sendInterviewMessage,
  skipInterview,
  resetInterview,
  type InterviewChatMessage,
  type InterviewStep,
} from '@/lib/api';
import { useToast } from '@/components/ui/toast';

/**
 * Onboarding Page - AI Financial Interview
 *
 * Authority-first design: calm, professional, direct.
 * No emojis, no friendly chat, just efficient data collection.
 */

const STEP_LABELS: Record<InterviewStep, string> = {
  cash: 'Efectivo',
  income: 'Ingresos',
  bills: 'Gastos fijos',
  debts: 'Deudas',
  spending: 'Gastos variables',
  ant_expenses: 'Gastos pequeños',
  savings: 'Ahorro',
  complete: 'Listo',
};

const STEP_ORDER: InterviewStep[] = [
  'cash',
  'income',
  'bills',
  'debts',
  'spending',
  'ant_expenses',
  'savings',
  'complete',
];

export default function OnboardingPage() {
  const router = useRouter();
  const { interview, isLoading, error, refresh } = useInterview();
  const { showToast } = useToast();

  const [messages, setMessages] = useState<InterviewChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [currentStep, setCurrentStep] = useState<InterviewStep>('cash');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Initialize from interview state
  useEffect(() => {
    if (interview) {
      // If interview is complete, redirect to dashboard
      if (interview.isComplete || interview.status === 'completed') {
        router.push('/dashboard');
        return;
      }

      // Load conversation history
      if (interview.conversationHistory.length > 0) {
        setMessages(interview.conversationHistory);
      } else if (interview.initialMessage) {
        // Add initial message from system
        setMessages([
          {
            role: 'assistant',
            content: interview.initialMessage,
            timestamp: Date.now(),
          },
        ]);
      }

      setCurrentStep(interview.currentStep);
    }
  }, [interview, router]);

  // Focus input on load
  useEffect(() => {
    if (!isLoading) {
      inputRef.current?.focus();
    }
  }, [isLoading]);

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isSending) return;

    const userMessage: InterviewChatMessage = {
      role: 'user',
      content: inputValue.trim(),
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setIsSending(true);

    try {
      const response = await sendInterviewMessage(userMessage.content);

      const assistantMessage: InterviewChatMessage = {
        role: 'assistant',
        content: response.message,
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
      setCurrentStep(response.currentStep);

      // If interview is complete, show summary and redirect
      if (response.isComplete) {
        showToast('Entrevista completada', 'success');
        setTimeout(() => {
          router.push('/dashboard');
        }, 2000);
      }
    } catch (err) {
      console.error('Failed to send message:', err);
      showToast('Error al enviar mensaje. Intenta de nuevo.', 'error');
    } finally {
      setIsSending(false);
      inputRef.current?.focus();
    }
  };

  const handleSkip = async () => {
    try {
      await skipInterview();
      showToast('Puedes completar esta información más tarde.', 'info');
      router.push('/dashboard');
    } catch (err) {
      console.error('Failed to skip interview:', err);
      showToast('Error al saltar la entrevista.', 'error');
    }
  };

  // Reset interview (dev mode only)
  const handleReset = async () => {
    try {
      await resetInterview();
      setMessages([]);
      setCurrentStep('cash');
      refresh();
      showToast('Entrevista reiniciada.', 'info');
    } catch (err) {
      console.error('Failed to reset interview:', err);
      showToast('Error al reiniciar la entrevista.', 'error');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Cargando...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 mb-4">Error al cargar la entrevista.</p>
          <button
            onClick={() => refresh()}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  const stepIndex = STEP_ORDER.indexOf(currentStep);
  const progress = ((stepIndex + 1) / STEP_ORDER.length) * 100;

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      {/* Header with progress */}
      <header className="fixed top-0 left-0 right-0 z-10 bg-gray-900/95 backdrop-blur border-b border-gray-800">
        <div className="max-w-2xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-lg font-medium">BudgetCopilot</span>
            <div className="flex items-center gap-3">
              {/* Reset button - dev mode */}
              {process.env.NODE_ENV === 'development' && (
                <button
                  onClick={handleReset}
                  className="text-sm text-red-400 hover:text-red-300 transition-colors"
                >
                  Reset
                </button>
              )}
              <button
                onClick={handleSkip}
                className="text-sm text-gray-400 hover:text-white transition-colors"
              >
                Saltar
              </button>
            </div>
          </div>

          {/* Progress bar */}
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1 bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-cyan-500 to-purple-500 transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-xs text-gray-500">
              {STEP_LABELS[currentStep]}
            </span>
          </div>
        </div>
      </header>

      {/* Chat messages */}
      <main className="flex-1 pt-24 pb-24 px-4 overflow-y-auto">
        <div className="max-w-2xl mx-auto space-y-4">
          {messages.map((msg, idx) => (
            <div
              key={idx}
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

          {/* Typing indicator */}
          {isSending && (
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

          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* Input area */}
      <footer className="fixed bottom-0 left-0 right-0 bg-gray-900/95 backdrop-blur border-t border-gray-800">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="flex gap-3">
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Escribe tu respuesta..."
              disabled={isSending}
              className="flex-1 px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 disabled:opacity-50 transition-all"
            />
            <button
              onClick={handleSendMessage}
              disabled={!inputValue.trim() || isSending}
              className="px-6 py-3 bg-cyan-600 hover:bg-cyan-500 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-xl font-medium transition-colors"
            >
              Enviar
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
