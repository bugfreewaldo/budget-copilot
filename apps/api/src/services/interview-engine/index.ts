/**
 * Interview Engine Service
 *
 * AI-powered financial interview using Claude with authority tone.
 * Extracts structured financial data through conversational interview.
 */

import { callTextModel, safeParseJson } from '../file-upload/llm.js';
import {
  INTERVIEW_SYSTEM_PROMPT,
  STEP_PROMPTS,
  JSON_OUTPUT_INSTRUCTION,
} from './system-prompt.js';

// ============================================================================
// Types
// ============================================================================

export type InterviewStep =
  | 'cash'
  | 'income'
  | 'bills'
  | 'debts'
  | 'spending'
  | 'ant_expenses'
  | 'savings'
  | 'complete';

export type Confidence = 'high' | 'medium' | 'low';

export type InsightFlag =
  | 'overspend'
  | 'no_buffer'
  | 'ant_expenses_high'
  | 'no_savings'
  | 'debt_pressure';

export interface ValueWithConfidence {
  value: number | null;
  confidence: Confidence;
}

export interface BillItem {
  name: string;
  amount: number;
  frequency: 'monthly' | 'weekly' | 'biweekly';
  confidence: Confidence;
}

export interface DebtItem {
  name: string;
  balance: number;
  minimum: number | null;
  apr: number | null;
  confidence: Confidence;
}

export interface ExtractedData {
  cash_available: ValueWithConfidence | null;
  income_monthly: ValueWithConfidence | null;
  bills: BillItem[] | null;
  debts: DebtItem[] | null;
  variable_spending_estimate: ValueWithConfidence | null;
  ant_expenses_estimate: ValueWithConfidence | null;
  savings_monthly: ValueWithConfidence | null;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface InterviewState {
  currentStep: InterviewStep;
  extractedData: ExtractedData;
  conversationHistory: ChatMessage[];
  insightFlags: InsightFlag[];
  isComplete: boolean;
}

export interface InterviewResponse {
  message: string;
  extractedData: Partial<ExtractedData>;
  currentStep: InterviewStep;
  stepComplete: boolean;
  nextStep: InterviewStep | null;
  insightFlags: InsightFlag[];
  notes: string[];
}

// ============================================================================
// Constants
// ============================================================================

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

const EMPTY_EXTRACTED_DATA: ExtractedData = {
  cash_available: null,
  income_monthly: null,
  bills: null,
  debts: null,
  variable_spending_estimate: null,
  ant_expenses_estimate: null,
  savings_monthly: null,
};

// ============================================================================
// Main Functions
// ============================================================================

/**
 * Initialize a new interview session
 */
export function initializeInterview(): InterviewState {
  return {
    currentStep: 'cash',
    extractedData: { ...EMPTY_EXTRACTED_DATA },
    conversationHistory: [],
    insightFlags: [],
    isComplete: false,
  };
}

/**
 * Get the initial greeting message for the interview
 */
export function getInitialMessage(): string {
  return (
    STEP_PROMPTS.expectation_set.question + '\n\n' + STEP_PROMPTS.cash.question
  );
}

/**
 * Process a user message in the interview
 */
export async function processInterviewMessage(
  userMessage: string,
  state: InterviewState
): Promise<{ response: string; newState: InterviewState }> {
  // Add user message to history
  const updatedHistory: ChatMessage[] = [
    ...state.conversationHistory,
    {
      role: 'user',
      content: userMessage,
      timestamp: Date.now(),
    },
  ];

  // Build the context for the LLM
  const conversationContext = buildConversationContext(updatedHistory);
  const currentStepInfo = STEP_PROMPTS[state.currentStep] || STEP_PROMPTS.cash;

  const systemPrompt = `${INTERVIEW_SYSTEM_PROMPT}

## CURRENT CONTEXT

Current step: ${state.currentStep}
Goal: ${currentStepInfo.goal}
${currentStepInfo.ahaOpportunity ? `Aha opportunity: ${currentStepInfo.ahaOpportunity}` : ''}

## EXTRACTED DATA SO FAR
${JSON.stringify(state.extractedData, null, 2)}

## INSIGHT FLAGS SO FAR
${JSON.stringify(state.insightFlags)}

${JSON_OUTPUT_INSTRUCTION}`;

  const userPrompt = `Conversation so far:
${conversationContext}

User's latest message: "${userMessage}"

Respond as the interview agent. Extract any financial data from the user's message and decide whether to move to the next step.`;

  try {
    const result = await callTextModel({
      systemPrompt,
      userPrompt,
      maxTokens: 2048,
    });

    const parsed = safeParseJson<InterviewResponse>(result.text);

    if (!parsed) {
      // Fallback if parsing fails
      return {
        response: 'Entendido. ¿Puedes darme más detalles?',
        newState: {
          ...state,
          conversationHistory: updatedHistory,
        },
      };
    }

    // Merge extracted data
    const mergedData = mergeExtractedData(
      state.extractedData,
      parsed.extractedData
    );

    // Merge insight flags
    const mergedFlags = Array.from(
      new Set([...state.insightFlags, ...parsed.insightFlags])
    ) as InsightFlag[];

    // Determine next step
    const nextStep = parsed.stepComplete
      ? getNextStep(state.currentStep)
      : state.currentStep;

    const isComplete =
      nextStep === 'complete' || parsed.currentStep === 'complete';

    // Add assistant message to history
    const finalHistory: ChatMessage[] = [
      ...updatedHistory,
      {
        role: 'assistant',
        content: parsed.message,
        timestamp: Date.now(),
      },
    ];

    return {
      response: parsed.message,
      newState: {
        currentStep: isComplete ? 'complete' : nextStep,
        extractedData: mergedData,
        conversationHistory: finalHistory,
        insightFlags: mergedFlags,
        isComplete,
      },
    };
  } catch (error) {
    console.error('Interview engine error:', error);
    return {
      response:
        'Hubo un error procesando tu respuesta. ¿Puedes intentar de nuevo?',
      newState: {
        ...state,
        conversationHistory: updatedHistory,
      },
    };
  }
}

/**
 * Generate the summary message when interview is complete
 */
export function generateSummaryMessage(data: ExtractedData): string {
  const formatAmount = (val: ValueWithConfidence | null): string => {
    if (!val || val.value === null) return 'No especificado';
    return `~$${val.value.toLocaleString()}`;
  };

  const billsTotal = data.bills?.reduce((sum, b) => sum + b.amount, 0) || 0;
  const debtsCount = data.debts?.length || 0;

  return `Esto es lo que voy a usar:

• Efectivo disponible: ${formatAmount(data.cash_available)}
• Ingreso mensual: ${formatAmount(data.income_monthly)}
• Gastos fijos: ~$${billsTotal.toLocaleString()}
• Gastos variables: ${formatAmount(data.variable_spending_estimate)}
• Gastos pequeños recurrentes: ${formatAmount(data.ant_expenses_estimate)}
• Deudas: ${debtsCount} cuenta${debtsCount !== 1 ? 's' : ''}
• Ahorro mensual: ${formatAmount(data.savings_monthly)}

Esto es suficiente para continuar.`;
}

/**
 * Skip the interview and proceed with defaults
 */
export function skipInterview(): InterviewState {
  return {
    currentStep: 'complete',
    extractedData: { ...EMPTY_EXTRACTED_DATA },
    conversationHistory: [],
    insightFlags: [],
    isComplete: true,
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

function buildConversationContext(history: ChatMessage[]): string {
  return history
    .map(
      (msg) => `${msg.role === 'user' ? 'Usuario' : 'Sistema'}: ${msg.content}`
    )
    .join('\n');
}

function getNextStep(currentStep: InterviewStep): InterviewStep {
  const currentIndex = STEP_ORDER.indexOf(currentStep);
  if (currentIndex === -1 || currentIndex >= STEP_ORDER.length - 1) {
    return 'complete';
  }
  return STEP_ORDER[currentIndex + 1];
}

function mergeExtractedData(
  existing: ExtractedData,
  incoming: Partial<ExtractedData>
): ExtractedData {
  return {
    cash_available: incoming.cash_available || existing.cash_available,
    income_monthly: incoming.income_monthly || existing.income_monthly,
    bills: mergeBills(existing.bills, incoming.bills),
    debts: mergeDebts(existing.debts, incoming.debts),
    variable_spending_estimate:
      incoming.variable_spending_estimate ||
      existing.variable_spending_estimate,
    ant_expenses_estimate:
      incoming.ant_expenses_estimate || existing.ant_expenses_estimate,
    savings_monthly: incoming.savings_monthly || existing.savings_monthly,
  };
}

function mergeBills(
  existing: BillItem[] | null,
  incoming: BillItem[] | null | undefined
): BillItem[] | null {
  if (!incoming) return existing;
  if (!existing) return incoming;

  // Merge by name, preferring incoming
  const merged = new Map<string, BillItem>();
  existing.forEach((b) => merged.set(b.name.toLowerCase(), b));
  incoming.forEach((b) => merged.set(b.name.toLowerCase(), b));
  return Array.from(merged.values());
}

function mergeDebts(
  existing: DebtItem[] | null,
  incoming: DebtItem[] | null | undefined
): DebtItem[] | null {
  if (!incoming) return existing;
  if (!existing) return incoming;

  const merged = new Map<string, DebtItem>();
  existing.forEach((d) => merged.set(d.name.toLowerCase(), d));
  incoming.forEach((d) => merged.set(d.name.toLowerCase(), d));
  return Array.from(merged.values());
}

/**
 * Calculate insight flags based on extracted data
 */
export function calculateInsightFlags(data: ExtractedData): InsightFlag[] {
  const flags: InsightFlag[] = [];

  const income = data.income_monthly?.value || 0;
  const billsTotal = data.bills?.reduce((sum, b) => sum + b.amount, 0) || 0;
  const variableSpending = data.variable_spending_estimate?.value || 0;
  const antExpenses = data.ant_expenses_estimate?.value || 0;
  const savings = data.savings_monthly?.value || 0;
  const cash = data.cash_available?.value || 0;

  const totalExpenses = billsTotal + variableSpending + antExpenses;

  // Overspend: expenses > income
  if (income > 0 && totalExpenses > income) {
    flags.push('overspend');
  }

  // No buffer: cash < 1 month of expenses
  if (totalExpenses > 0 && cash < totalExpenses) {
    flags.push('no_buffer');
  }

  // Ant expenses high: > 10% of income
  if (income > 0 && antExpenses > income * 0.1) {
    flags.push('ant_expenses_high');
  }

  // No savings
  if (savings === 0 || savings === null) {
    flags.push('no_savings');
  }

  // Debt pressure: has debts with high APR
  const hasHighAprDebt = data.debts?.some((d) => d.apr && d.apr > 15);
  if (hasHighAprDebt) {
    flags.push('debt_pressure');
  }

  return flags;
}
