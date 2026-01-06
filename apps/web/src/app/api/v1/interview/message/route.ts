import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { interviewSessions, userProfiles } from '@/lib/db/schema';
import { getAuthenticatedUser } from '@/lib/api/auth';
import { errorJson, formatZodError, json } from '@/lib/api/utils';
import { nanoid } from 'nanoid';

export const dynamic = 'force-dynamic';

const messageSchema = z.object({
  message: z.string().min(1).max(2000),
});

type InterviewStep =
  | 'cash'
  | 'income'
  | 'bills'
  | 'debts'
  | 'spending'
  | 'ant_expenses'
  | 'savings'
  | 'complete';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

// Step-specific transitions with micro-reflections (authority tone, Spanish)
// Based on CEO's complete copy rewrite for authority without judgment
// Each step has: acknowledgment (clear) + acknowledgment (unclear) + reflection ("aha") + question
interface StepResponse {
  acknowledgment: string;
  acknowledgmentUnclear: string;
  reflection: string;
  question: string;
}

const STEP_RESPONSES: Record<InterviewStep, StepResponse> = {
  cash: {
    acknowledgment: '',
    acknowledgmentUnclear: '',
    reflection: '',
    question:
      '¿Cuánto dinero tienes disponible ahora mismo?\nIncluye lo que tengas en cuentas o efectivo que puedas usar hoy.',
  },
  income: {
    acknowledgment: 'Entendido. Tomaré este monto como base.',
    acknowledgmentUnclear:
      'Tomaré $0 como referencia por ahora.\nEsto indica poca tolerancia a imprevistos inmediatos.',
    reflection: '',
    question:
      '¿Cuánto ganas en un mes típico?\nIncluye tu salario neto y cualquier ingreso regular.',
  },
  bills: {
    acknowledgment: 'Usaré este monto al mes como ingreso base.',
    acknowledgmentUnclear: 'Usaré un estimado conservador como ingreso base.',
    reflection: '',
    question:
      '¿Qué gastos fijos pagas todos los meses?\nRenta o hipoteca, servicios, seguros, teléfono, internet, suscripciones.',
  },
  debts: {
    acknowledgment: 'De acuerdo.',
    acknowledgmentUnclear:
      'No es necesario que sean exactos.\nUsaré estimados conservadores y los ajustaremos después.',
    reflection: 'Estos gastos definen cuánto margen real tienes cada mes.',
    question:
      '¿Tienes deudas actualmente?\nTarjetas de crédito, préstamos, compras a plazos, cualquier deuda con interés.',
  },
  spending: {
    acknowledgment: 'Entendido.',
    acknowledgmentUnclear:
      'Es común cuando hay varias deudas activas.\nCuando las deudas no están claras, la presión suele sentirse mayor de lo necesario.',
    reflection: '',
    question:
      'En un mes normal, ¿cuánto gastas aproximadamente en gastos variables?\nComida, transporte, entretenimiento, compras.',
  },
  ant_expenses: {
    acknowledgment: 'Entendido.',
    acknowledgmentUnclear: 'Usaré un promedio conservador para continuar.',
    reflection: '',
    question:
      'Además de eso, ¿hay gastos pequeños que se repiten y se van sumando?\nCafé, snacks, apps, pedidos, transporte rápido.',
  },
  savings: {
    acknowledgment: 'Perfecto. Los incluiré como gastos recurrentes.',
    acknowledgmentUnclear:
      'Tomaré un estimado pequeño pero constante.\nEstos gastos suelen pasar desapercibidos hasta que se acumulan.',
    reflection: '',
    question:
      '¿Ahorras algo de forma regular?\nFondo de emergencia, cuenta de ahorros, o cualquier forma de ahorro.',
  },
  complete: {
    acknowledgment: 'Entendido.',
    acknowledgmentUnclear:
      'Registraré $0 en ahorros por ahora.\nEl ahorro funciona como amortiguador cuando algo se sale de lo esperado.',
    reflection: '',
    question:
      'Esta información es suficiente para continuar.\nTu primera instrucción financiera está siendo calculada.',
  },
};

// Detect if user says "no sé" or gives unclear answers
const UNCLEAR_TRIGGERS = [
  'no sé',
  'no se',
  'no estoy seguro',
  'no tengo idea',
  'ni idea',
  'no lo he pensado',
];

// Check if message indicates uncertainty
function isUnclearAnswer(message: string): boolean {
  const normalized = message.toLowerCase();
  return UNCLEAR_TRIGGERS.some((trigger) => normalized.includes(trigger));
}

// Parse amount from user message
function parseAmount(message: string): number | null {
  const normalized = message.toLowerCase().replace(/,/g, '').replace(/\s/g, '');

  // Handle "nada", "0", "cero"
  if (normalized === 'nada' || normalized === '0' || normalized === 'cero') {
    return 0;
  }

  // Try to extract number
  const match = normalized.match(/[\d.]+/);
  if (match) {
    const value = parseFloat(match[0]);
    // If user wrote "mil", multiply by 1000
    if (normalized.includes('mil')) {
      return value * 1000;
    }
    return value;
  }

  return null;
}

// Get next step
function getNextStep(current: InterviewStep): InterviewStep {
  const steps: InterviewStep[] = [
    'cash',
    'income',
    'bills',
    'debts',
    'spending',
    'ant_expenses',
    'savings',
    'complete',
  ];
  const idx = steps.indexOf(current);
  return steps[Math.min(idx + 1, steps.length - 1)]!;
}

// Generate response based on step and input
function generateResponse(
  step: InterviewStep,
  userMessage: string
): { response: string; nextStep: InterviewStep; isComplete: boolean } {
  const amount = parseAmount(userMessage);
  const unclear = isUnclearAnswer(userMessage);
  const nextStep = getNextStep(step);
  const nextStepData = STEP_RESPONSES[nextStep];

  // Build response with: acknowledgment + reflection + question
  const parts: string[] = [];

  // Choose acknowledgment based on whether answer was clear or unclear
  if (amount !== null && !unclear) {
    // Clear answer with a number
    if (nextStepData.acknowledgment) {
      parts.push(nextStepData.acknowledgment);
    }
  } else if (unclear || amount === null) {
    // User explicitly said "no sé" or couldn't parse a number
    if (nextStepData.acknowledgmentUnclear) {
      parts.push(nextStepData.acknowledgmentUnclear);
    }
  }

  // Add micro-reflection (the "aha" moment) - only if present
  if (nextStepData.reflection) {
    parts.push(nextStepData.reflection);
  }

  // Handle completion
  if (nextStep === 'complete') {
    return {
      response: parts.join('\n\n') + '\n\n' + nextStepData.question,
      nextStep,
      isComplete: true,
    };
  }

  // Add question for next step
  if (parts.length > 0) {
    parts.push('\n\n' + nextStepData.question);
  } else {
    parts.push(nextStepData.question);
  }

  return {
    response: parts.join(' ').trim(),
    nextStep,
    isComplete: false,
  };
}

// Calculate insight flags
function calculateInsightFlags(
  extractedData: Record<string, unknown>
): string[] {
  const flags: string[] = [];

  const income =
    (extractedData.income_monthly as { value?: number })?.value || 0;
  const spending =
    (extractedData.spending_monthly as { value?: number })?.value || 0;
  const antExpenses =
    (extractedData.ant_expenses as { value?: number })?.value || 0;
  const savings =
    (extractedData.savings_monthly as { value?: number })?.value || 0;
  const cash = (extractedData.cash_available as { value?: number })?.value || 0;
  const bills = (extractedData.bills_monthly as { value?: number })?.value || 0;

  // Check for overspending
  if (income > 0 && spending + bills > income * 0.9) {
    flags.push('overspend');
  }

  // Check for no buffer
  if (income > 0 && cash < income * 0.5) {
    flags.push('no_buffer');
  }

  // Check for high ant expenses
  if (income > 0 && antExpenses > income * 0.1) {
    flags.push('ant_expenses_high');
  }

  // Check for no savings
  if (savings === 0 || savings < income * 0.05) {
    flags.push('no_savings');
  }

  return flags;
}

/**
 * POST /api/v1/interview/message - Send message to interview
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(request);
    if (!auth.success) return auth.response;

    const body = await request.json();
    const validation = messageSchema.safeParse(body);

    if (!validation.success) {
      return json(formatZodError(validation.error), 400);
    }

    const { message } = validation.data;
    const userId = auth.user.id;
    const db = getDb();

    // Get existing session
    const session = await db
      .select()
      .from(interviewSessions)
      .where(eq(interviewSessions.userId, userId))
      .get();

    if (!session) {
      return errorJson(
        'NOT_FOUND',
        'No hay sesión de entrevista. Comienza una nueva.',
        404
      );
    }

    if (session.status === 'completed') {
      return errorJson('VALIDATION_ERROR', 'Entrevista ya completada.', 400);
    }

    // Parse stored state
    const conversationHistory: ChatMessage[] = session.conversationHistory
      ? JSON.parse(session.conversationHistory)
      : [];
    const extractedData = session.extractedData
      ? JSON.parse(session.extractedData)
      : {};

    // Add user message
    const userMsg: ChatMessage = {
      role: 'user',
      content: message,
      timestamp: Date.now(),
    };
    conversationHistory.push(userMsg);

    // Extract value from user message and store it
    const amount = parseAmount(message);
    const currentStep = session.currentStep as InterviewStep;

    if (amount !== null) {
      const stepDataMap: Record<string, string> = {
        cash: 'cash_available',
        income: 'income_monthly',
        bills: 'bills_monthly',
        debts: 'debts_total',
        spending: 'spending_monthly',
        ant_expenses: 'ant_expenses',
        savings: 'savings_monthly',
      };
      const dataKey = stepDataMap[currentStep];
      if (dataKey) {
        extractedData[dataKey] = { value: amount, source: 'user_input' };
      }
    }

    // Generate response
    const { response, nextStep, isComplete } = generateResponse(
      currentStep,
      message
    );

    // Add assistant message
    const assistantMsg: ChatMessage = {
      role: 'assistant',
      content: response,
      timestamp: Date.now(),
    };
    conversationHistory.push(assistantMsg);

    // Calculate insight flags
    const insightFlags = calculateInsightFlags(extractedData);

    // Update session
    await db
      .update(interviewSessions)
      .set({
        currentStep: nextStep,
        conversationHistory: JSON.stringify(conversationHistory),
        extractedData: JSON.stringify(extractedData),
        insightFlags: JSON.stringify(insightFlags),
        status: isComplete ? 'completed' : 'in_progress',
        completedAt: isComplete ? Date.now() : undefined,
        lastActivityAt: Date.now(),
      })
      .where(eq(interviewSessions.id, session.id));

    // If complete, update user profile
    if (isComplete) {
      const existingProfile = await db
        .select()
        .from(userProfiles)
        .where(eq(userProfiles.userId, userId))
        .get();

      const profileData = {
        onboardingCompleted: true,
        onboardingStep: 8,
        monthlySalaryCents: extractedData.income_monthly?.value
          ? Math.round(extractedData.income_monthly.value * 100)
          : undefined,
        monthlySavingsGoalCents: extractedData.savings_monthly?.value
          ? Math.round(extractedData.savings_monthly.value * 100)
          : undefined,
        updatedAt: Date.now(),
      };

      if (existingProfile) {
        await db
          .update(userProfiles)
          .set(profileData)
          .where(eq(userProfiles.userId, userId));
      } else {
        await db.insert(userProfiles).values({
          id: nanoid(),
          userId,
          ...profileData,
          createdAt: Date.now(),
        });
      }
    }

    return NextResponse.json({
      data: {
        message: response,
        currentStep: nextStep,
        isComplete,
        insightFlags,
        summary: isComplete
          ? 'Tu información financiera ha sido registrada. Ya puedes ver tu instrucción diaria.'
          : null,
      },
    });
  } catch (error) {
    console.error('Failed to process interview message:', error);
    return errorJson('INTERNAL_ERROR', 'Failed to process message', 500);
  }
}
