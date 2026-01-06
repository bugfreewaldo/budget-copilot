import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { getDb } from '@/lib/db/client';
import { interviewSessions } from '@/lib/db/schema';
import { getAuthenticatedUser } from '@/lib/api/auth';
import { errorJson } from '@/lib/api/utils';

export const dynamic = 'force-dynamic';

// Initial message (authority tone, Spanish - context setting, ONE TIME ONLY)
const INITIAL_MESSAGE = `Te haré algunas preguntas para entender tu situación financiera.
Responde lo que sepas. Los estimados son suficientes. Ajustaremos si es necesario.

¿Cuánto dinero tienes disponible ahora mismo?
Incluye lo que tengas en cuentas o efectivo que puedas usar hoy.`;

// Initialize empty extracted data
function initializeExtractedData() {
  return {
    cash_available: null,
    income_monthly: null,
    bills: [],
    debts: [],
    spending_monthly: null,
    ant_expenses: null,
    savings_monthly: null,
  };
}

/**
 * GET /api/v1/interview - Get current interview state or create new
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(request);
    if (!auth.success) return auth.response;

    const userId = auth.user.id;
    const db = getDb();

    // Check for existing session
    const existingSession = await db
      .select()
      .from(interviewSessions)
      .where(eq(interviewSessions.userId, userId))
      .get();

    if (existingSession) {
      const conversationHistory = existingSession.conversationHistory
        ? JSON.parse(existingSession.conversationHistory)
        : [];
      const extractedData = existingSession.extractedData
        ? JSON.parse(existingSession.extractedData)
        : initializeExtractedData();
      const insightFlags = existingSession.insightFlags
        ? JSON.parse(existingSession.insightFlags)
        : [];

      return NextResponse.json({
        data: {
          id: existingSession.id,
          status: existingSession.status,
          currentStep: existingSession.currentStep,
          conversationHistory,
          extractedData,
          insightFlags,
          isComplete: existingSession.status === 'completed',
          initialMessage:
            conversationHistory.length === 0 ? INITIAL_MESSAGE : null,
        },
      });
    }

    // Create new session
    const newSession = {
      id: nanoid(),
      userId,
      status: 'in_progress' as const,
      currentStep: 'cash' as const,
      conversationHistory: JSON.stringify([]),
      extractedData: JSON.stringify(initializeExtractedData()),
      insightFlags: JSON.stringify([]),
      uploadedFileIds: JSON.stringify([]),
      startedAt: Date.now(),
      lastActivityAt: Date.now(),
    };

    await db.insert(interviewSessions).values(newSession);

    return NextResponse.json({
      data: {
        id: newSession.id,
        status: newSession.status,
        currentStep: newSession.currentStep,
        conversationHistory: [],
        extractedData: initializeExtractedData(),
        insightFlags: [],
        isComplete: false,
        initialMessage: INITIAL_MESSAGE,
      },
    });
  } catch (error) {
    console.error('Failed to get interview state:', error);
    return errorJson('INTERNAL_ERROR', 'Failed to get interview state', 500);
  }
}

/**
 * DELETE /api/v1/interview - Reset interview session
 */
export async function DELETE(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(request);
    if (!auth.success) return auth.response;

    const userId = auth.user.id;
    const db = getDb();

    await db
      .delete(interviewSessions)
      .where(eq(interviewSessions.userId, userId));

    return NextResponse.json({
      data: {
        success: true,
        message: 'Entrevista reiniciada. Comienza de nuevo para empezar.',
      },
    });
  } catch (error) {
    console.error('Failed to reset interview:', error);
    return errorJson('INTERNAL_ERROR', 'Failed to reset interview', 500);
  }
}
