import { NextRequest, NextResponse } from 'next/server';
import { eq, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { getDb } from '@/lib/db/client';
import { advisorSessions } from '@/lib/db/schema';
import { getAuthenticatedUser } from '@/lib/api/auth';
import { errorJson } from '@/lib/api/utils';

export const dynamic = 'force-dynamic';

// Initial message for the advisor
const INITIAL_MESSAGE = `Este es tu espacio para actualizar tu situación financiera.

Puedes subir documentos, aclarar gastos, o hacer preguntas.

Si algo cambia lo suficiente, la decisión de hoy se ajustará automáticamente.`;

// Paywall content for free users
const PAYWALL = {
  title: 'Asesor Financiero',
  message:
    'Para consultar o subir documentos, necesitas Pro. Esto permite que BudgetCopilot ajuste tus decisiones con información real.',
  ctaText: 'Desbloquear asesor financiero',
  ctaUrl: '/pricing',
};

/**
 * GET /api/v1/advisor - Get advisor session state
 *
 * Returns paywall for free users, session state for paid users
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(request);
    if (!auth.success) return auth.response;

    const user = auth.user;

    // Check if user is paid (pro or premium)
    if (user.plan === 'free') {
      return NextResponse.json({
        data: {
          isPaid: false,
          paywall: PAYWALL,
        },
      });
    }

    // Get or create session for paid users
    const db = getDb();

    // Check for existing active session
    const session = await db
      .select()
      .from(advisorSessions)
      .where(
        and(
          eq(advisorSessions.userId, user.id),
          eq(advisorSessions.status, 'active')
        )
      )
      .get();

    // Create new session if none exists
    if (!session) {
      const sessionId = nanoid();
      const newSession = {
        id: sessionId,
        userId: user.id,
        status: 'active' as const,
        conversationHistory: JSON.stringify([]),
        pendingChanges: null,
        createdAt: Date.now(),
        lastActivityAt: Date.now(),
      };

      await db.insert(advisorSessions).values(newSession);

      return NextResponse.json({
        data: {
          isPaid: true,
          session: {
            id: sessionId,
            conversationHistory: [],
            pendingChanges: null,
          },
          welcomeMessage: INITIAL_MESSAGE,
        },
      });
    }

    // Parse session data
    const conversationHistory = session.conversationHistory
      ? JSON.parse(session.conversationHistory)
      : [];

    const pendingChanges = session.pendingChanges
      ? JSON.parse(session.pendingChanges)
      : null;

    return NextResponse.json({
      data: {
        isPaid: true,
        session: {
          id: session.id,
          conversationHistory,
          pendingChanges,
        },
        welcomeMessage:
          conversationHistory.length === 0 ? INITIAL_MESSAGE : null,
      },
    });
  } catch (error) {
    console.error('Failed to get advisor session:', error);
    return errorJson('INTERNAL_ERROR', 'Failed to get advisor session', 500);
  }
}
