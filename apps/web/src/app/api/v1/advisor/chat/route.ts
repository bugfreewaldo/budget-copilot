import { NextRequest, NextResponse } from 'next/server';
import { eq, and } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { advisorSessions } from '@/lib/db/schema';
import { getAuthenticatedUser } from '@/lib/api/auth';
import { errorJson } from '@/lib/api/utils';
import Anthropic from '@anthropic-ai/sdk';
import { nanoid } from 'nanoid';
import { enrichTransactions } from '@/lib/import-pipeline';
import type { ParsedBankStatement } from '@/lib/file-upload/types';
import type {
  DocumentContext,
  EnrichmentResult,
} from '@/lib/import-pipeline/types';

export const dynamic = 'force-dynamic';

// Initialize Anthropic client
const anthropic = new Anthropic();

// System prompt - LOCKED, do not modify
const ADVISOR_SYSTEM_PROMPT = `Eres el Asesor Financiero de BudgetCopilot.

Tu rol: ayudar al usuario a ACTUALIZAR su realidad financiera (ingresos, gastos, deudas) y a ENTENDER su situación,
para que el sistema pueda recalcular la decisión del día si es necesario.

PRINCIPIO CENTRAL:
- La Decisión del Día manda.
- El Asesor escucha y actualiza información.
- El Asesor NO da órdenes ni recomendaciones.
- El Asesor NUNCA escribe cambios sin confirmación explícita.

TONO:
- Profesional, claro, humano.
- Sin emojis.
- Sin entusiasmo artificial.
- Sin frases motivacionales.
- Frases cortas. Cero relleno.

PROHIBIDO (NUNCA):
- "Deberías…", "Te recomiendo…", "Lo mejor es…"
- Dar estrategias de pago o planes por iniciativa propia
- Presionar o avergonzar
- Cambiar datos sin preguntar primero
- Presentar suposiciones como hechos

SÍ PUEDES:
- Hacer preguntas aclaratorias
- Resumir lo que el usuario dijo en una frase
- Detectar inconsistencias y señalarlas con neutralidad
- Proponer un borrador de cambios para confirmar
- Explicar consecuencias generales ("esto puede cambiar la decisión de hoy")
- Simular escenarios SOLO si el usuario lo pide ("¿qué pasa si…?")

TIPOS DE INTERACCIÓN (CLASIFICA CADA MENSAJE):
1) ACTUALIZACIÓN:
   Ej: "me pagaron", "olvidé un gasto", "tengo un nuevo recibo", "subí un estado de cuenta"
   → Extrae cambios propuestos en pendingChanges.
   → Pregunta: "Esto puede cambiar la decisión de hoy. ¿Deseas que lo tenga en cuenta?"
2) PREGUNTA:
   Ej: "¿por qué estoy en riesgo?", "¿qué significa margen limitado?"
   → Responde con explicación factual breve basada en los datos disponibles.
   → Si para responder se necesita dato faltante, pide 1 pregunta concreta.
3) CORRECCIÓN / DISPUTA:
   Ej: "ese gasto está mal", "esa transacción no es mía"
   → Identifica el item (pide fecha/monto si hace falta).
   → Propón corrección en pendingChanges y pide confirmación.
4) DOCUMENTO:
   Usuario sube PDF/CSV/XLSX/imagen
   → Resume en 3 líneas lo encontrado.
   → Propón importación en pendingChanges.
   → Pide confirmación antes de importar.

FORMATO DE SALIDA (SIEMPRE JSON):
Devuelves SIEMPRE un objeto JSON con:
- reply: string (texto al usuario)
- classification: "update" | "question" | "correction" | "document"
- pendingChanges: object | null
- requiresConfirmation: boolean
- confirmationPrompt: string | null
- suggestedNextAction: "none" | "confirm_changes" | "upload_more" | "recompute_decision"
- confidence: "high" | "medium" | "low"

REGLAS:
- Si pendingChanges existe, requiresConfirmation debe ser true y confirmationPrompt no puede ser null.
- Nunca confirmas por el usuario.
- Si hay ambigüedad, haces una sola pregunta concreta y sigues.
- Mantén la respuesta entre 1 y 6 líneas.`;

interface AdvisorMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  classification?: string;
  hasPendingChanges?: boolean;
}

interface AdvisorAIResponse {
  reply: string;
  classification: 'update' | 'question' | 'correction' | 'document';
  pendingChanges: Record<string, unknown> | null;
  requiresConfirmation: boolean;
  confirmationPrompt: string | null;
  suggestedNextAction:
    | 'none'
    | 'confirm_changes'
    | 'upload_more'
    | 'recompute_decision';
  confidence: 'high' | 'medium' | 'low';
}

/**
 * Format amount in dollars
 */
function formatAmount(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

/**
 * Format amount from raw number (already in dollars)
 */
function formatAmountRaw(amount: number): string {
  return `$${Math.abs(amount).toFixed(2)}`;
}

/**
 * Process file context and generate enrichment + human-readable summary
 */
function processFileContext(
  fileId: string,
  summaryJson: string
): {
  enrichment: EnrichmentResult;
  documentContext: DocumentContext;
  humanSummary: string;
} | null {
  try {
    const parsed = JSON.parse(summaryJson);

    // Check if it's a bank statement
    if (parsed.documentType !== 'bank_statement' || !parsed.transactions) {
      return null;
    }

    const bankStatement = parsed as ParsedBankStatement;

    // Run enrichment
    const enrichment = enrichTransactions(bankStatement.transactions);

    // Build document context
    const documentContext: DocumentContext = {
      fileId,
      documentType: 'bank_statement',
      accountName: bankStatement.accountName,
      period: bankStatement.period
        ? {
            from: bankStatement.period.from ?? null,
            to: bankStatement.period.to ?? null,
          }
        : undefined,
      stats: enrichment.stats,
      enrichment,
    };

    // Build human-readable summary for Claude
    const { stats, transactions } = enrichment;
    const parts: string[] = [];

    // Period
    if (stats.dateRange.from && stats.dateRange.to) {
      parts.push(`Período: ${stats.dateRange.from} a ${stats.dateRange.to}`);
    }

    // Counts
    parts.push(`${stats.totalCount} transacciones en total`);
    parts.push(
      `${stats.expenseCount} gastos (${formatAmount(stats.totalExpenseCents)})`
    );
    parts.push(
      `${stats.incomeCount} ingresos (${formatAmount(stats.totalIncomeCents)})`
    );

    if (stats.transferCount > 0) {
      parts.push(`${stats.transferCount} transferencias detectadas`);
    }

    if (stats.uncategorizedCount > 0) {
      parts.push(`${stats.uncategorizedCount} sin categoría`);
    }

    if (stats.microFeeCount > 0) {
      parts.push(`${stats.microFeeCount} micro-cargos (< $1)`);
    }

    // Add top expenses (sorted by amount descending)
    const expenses = transactions
      .filter((tx) => !tx.isCredit && !tx.isTransfer)
      .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));

    if (expenses.length > 0) {
      const topExpenses = expenses.slice(0, 10);
      parts.push('\n\nMAYORES GASTOS:');
      topExpenses.forEach((tx, i) => {
        const category = tx.category.name || 'Sin categoría';
        parts.push(
          `${i + 1}. ${tx.date || 'Sin fecha'} - ${tx.description} - ${formatAmountRaw(tx.amount)} (${category})`
        );
      });
    }

    // Add top income (sorted by amount descending)
    const income = transactions
      .filter((tx) => tx.isCredit && !tx.isTransfer)
      .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));

    if (income.length > 0) {
      const topIncome = income.slice(0, 5);
      parts.push('\n\nMAYORES INGRESOS:');
      topIncome.forEach((tx, i) => {
        const category = tx.category.name || 'Sin categoría';
        parts.push(
          `${i + 1}. ${tx.date || 'Sin fecha'} - ${tx.description} - ${formatAmountRaw(tx.amount)} (${category})`
        );
      });
    }

    // Add spending by category summary
    const categoryTotals = new Map<string, number>();
    for (const tx of transactions) {
      if (!tx.isCredit && !tx.isTransfer) {
        const catName = tx.category.name || 'Sin categoría';
        categoryTotals.set(
          catName,
          (categoryTotals.get(catName) || 0) + Math.abs(tx.amount)
        );
      }
    }

    if (categoryTotals.size > 0) {
      const sortedCategories = [...categoryTotals.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8);

      parts.push('\n\nGASTOS POR CATEGORÍA:');
      sortedCategories.forEach(([cat, total]) => {
        parts.push(`- ${cat}: ${formatAmountRaw(total)}`);
      });
    }

    const humanSummary = parts.join('\n');

    return { enrichment, documentContext, humanSummary };
  } catch (error) {
    console.error('[advisor/chat] Failed to process file context:', error);
    return null;
  }
}

/**
 * POST /api/v1/advisor/chat - Send message to advisor
 *
 * Returns JSON with reply, classification, pendingChanges
 * NO database writes happen here - only pendingChanges are proposed
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
    const { message, sessionId, fileContext } = body as {
      message: string;
      sessionId: string;
      fileContext?: { fileId: string; summary: string };
    };

    if (!message && !fileContext) {
      return errorJson(
        'VALIDATION_ERROR',
        'Message or file context required',
        400
      );
    }

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

    // Parse conversation history
    const history: AdvisorMessage[] = session.conversationHistory
      ? JSON.parse(session.conversationHistory)
      : [];

    // Process file context if present
    let documentContext: DocumentContext | null = null;
    let fileProcessingResult: ReturnType<typeof processFileContext> = null;

    if (fileContext) {
      fileProcessingResult = processFileContext(
        fileContext.fileId,
        fileContext.summary
      );
      if (fileProcessingResult) {
        documentContext = fileProcessingResult.documentContext;
      }
    }

    // Build user message content
    let userMessageContent = message || '';
    if (fileContext) {
      if (fileProcessingResult) {
        // Use clean human-readable summary instead of raw JSON
        userMessageContent = `[DOCUMENTO SUBIDO]
Resumen del archivo: ${fileProcessingResult.humanSummary}

Mensaje del usuario: ${message || 'Subí este archivo.'}`;
      } else {
        // Fallback to raw summary if processing failed
        userMessageContent = `[DOCUMENTO SUBIDO]
Resumen del archivo: ${fileContext.summary}

Mensaje del usuario: ${message || 'Subí este archivo.'}`;
      }
    }

    // Build messages for Claude (last 10 messages for context)
    const claudeMessages: Anthropic.MessageParam[] = history
      .slice(-10)
      .map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));

    claudeMessages.push({
      role: 'user',
      content: userMessageContent,
    });

    // Call Claude
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: ADVISOR_SYSTEM_PROMPT,
      messages: claudeMessages,
    });

    // Parse response
    const firstContent = response.content[0];
    const responseText =
      firstContent && firstContent.type === 'text' ? firstContent.text : '';

    let aiResponse: AdvisorAIResponse;
    try {
      // Extract JSON from response (might be wrapped in markdown)
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        aiResponse = JSON.parse(jsonMatch[0]);
      } else {
        // Fallback if no JSON found
        aiResponse = {
          reply: responseText,
          classification: 'question',
          pendingChanges: null,
          requiresConfirmation: false,
          confirmationPrompt: null,
          suggestedNextAction: 'none',
          confidence: 'medium',
        };
      }
    } catch {
      // Parse error - return as simple reply
      aiResponse = {
        reply: responseText,
        classification: 'question',
        pendingChanges: null,
        requiresConfirmation: false,
        confirmationPrompt: null,
        suggestedNextAction: 'none',
        confidence: 'low',
      };
    }

    // Update conversation history
    const newUserMessage: AdvisorMessage = {
      id: nanoid(),
      role: 'user',
      content: userMessageContent,
      timestamp: Date.now(),
    };

    const newAssistantMessage: AdvisorMessage = {
      id: nanoid(),
      role: 'assistant',
      content: aiResponse.reply,
      timestamp: Date.now(),
      classification: aiResponse.classification,
      hasPendingChanges: aiResponse.pendingChanges !== null,
    };

    const updatedHistory = [...history, newUserMessage, newAssistantMessage];

    // Update session - store pending changes but DO NOT commit them
    await db
      .update(advisorSessions)
      .set({
        conversationHistory: JSON.stringify(updatedHistory),
        pendingChanges: aiResponse.pendingChanges
          ? JSON.stringify(aiResponse.pendingChanges)
          : null,
        lastActivityAt: Date.now(),
      })
      .where(eq(advisorSessions.id, sessionId));

    return NextResponse.json({
      data: {
        reply: aiResponse.reply,
        classification: aiResponse.classification,
        pendingChanges: aiResponse.pendingChanges,
        requiresConfirmation: aiResponse.requiresConfirmation,
        confirmationPrompt: aiResponse.confirmationPrompt,
        suggestedNextAction: aiResponse.suggestedNextAction,
        confidence: aiResponse.confidence,
        // Include document context when file was processed
        documentContext: documentContext ?? undefined,
        showModeSelector: documentContext !== null,
      },
    });
  } catch (error) {
    console.error('Failed to process advisor message:', error);
    return errorJson('INTERNAL_ERROR', 'Failed to process message', 500);
  }
}
