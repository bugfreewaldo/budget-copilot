import { NextRequest, NextResponse } from 'next/server';
import { eq, and } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { advisorSessions } from '@/lib/db/schema';
import { getAuthenticatedUser } from '@/lib/api/auth';
import { errorJson } from '@/lib/api/utils';

export const dynamic = 'force-dynamic';

// Initial message for the advisor (same as in main route)
const INITIAL_MESSAGE = `Este es tu espacio para actualizar tu situación financiera.

Puedes subir documentos, aclarar gastos, o hacer preguntas.

Si algo cambia lo suficiente, la decisión de hoy se ajustará automáticamente.`;

/**
 * POST /api/v1/advisor/reset - Reset advisor session
 *
 * Clears conversation history and pending changes, returns fresh state
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(request);
    if (!auth.success) return auth.response;

    const user = auth.user;

    // Verify paid user
    if (user.plan === 'free') {
      return errorJson('FORBIDDEN', 'Pro subscription required', 403);
    }

    const body = await request.json();
    const { sessionId } = body as { sessionId: string };

    if (!sessionId) {
      return errorJson('VALIDATION_ERROR', 'Session ID required', 400);
    }

    const db = getDb();

    // Get session
    const session = await db
      .select()
      .from(advisorSessions)
      .where(
        and(
          eq(advisorSessions.id, sessionId),
          eq(advisorSessions.userId, user.id)
        )
      )
      .get();

    if (!session) {
      return errorJson('NOT_FOUND', 'Session not found', 404);
    }

    // Reset session - clear history and pending changes
    await db
      .update(advisorSessions)
      .set({
        conversationHistory: JSON.stringify([]),
        pendingChanges: null,
        lastActivityAt: Date.now(),
      })
      .where(eq(advisorSessions.id, sessionId));

    return NextResponse.json({
      data: {
        success: true,
        message: 'Sesión reiniciada',
        session: {
          id: sessionId,
          conversationHistory: [],
          pendingChanges: null,
        },
        welcomeMessage: INITIAL_MESSAGE,
      },
    });
  } catch (error) {
    console.error('Failed to reset advisor session:', error);
    return errorJson('INTERNAL_ERROR', 'Failed to reset session', 500);
  }
}
