/**
 * Asesor Financiero Service
 *
 * A consultative AI interface for updating financial data.
 * Key principle: Decisions command. Advisor listens.
 *
 * NO direct database writes without user confirmation.
 * Everything goes through pendingChanges first.
 */

import Anthropic from '@anthropic-ai/sdk';
import { eq, and, desc } from 'drizzle-orm';
import { getDb } from '../../db/client.js';
import {
  advisorSessions,
  transactions,
  debts,
  scheduledBills,
  userProfiles,
  accounts,
  decisionState,
} from '../../db/schema.js';
import { nanoid } from 'nanoid';
import {
  ADVISOR_SYSTEM_PROMPT,
  type AdvisorAIResponse,
  type PendingChanges,
  shouldRecomputeDecision,
} from './system-prompt.js';

// Initialize Anthropic client
const anthropic = new Anthropic();

/**
 * Message in conversation history
 */
export interface AdvisorMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  classification?: 'update' | 'question' | 'correction' | 'document';
  hasPendingChanges?: boolean;
}

/**
 * Get or create advisor session for user
 */
export async function getOrCreateAdvisorSession(userId: string) {
  const db = getDb();

  // Check for existing active session
  const existing = await db
    .select()
    .from(advisorSessions)
    .where(
      and(
        eq(advisorSessions.userId, userId),
        eq(advisorSessions.status, 'active')
      )
    )
    .get();

  if (existing) {
    return {
      id: existing.id,
      conversationHistory: existing.conversationHistory
        ? JSON.parse(existing.conversationHistory)
        : [],
      pendingChanges: existing.pendingChanges
        ? JSON.parse(existing.pendingChanges)
        : null,
      lastConfirmedAt: existing.lastConfirmedAt,
    };
  }

  // Create new session
  const newSession = {
    id: nanoid(),
    userId,
    status: 'active' as const,
    conversationHistory: JSON.stringify([]),
    pendingChanges: null,
    createdAt: Date.now(),
    lastActivityAt: Date.now(),
  };

  await db.insert(advisorSessions).values(newSession);

  return {
    id: newSession.id,
    conversationHistory: [],
    pendingChanges: null,
    lastConfirmedAt: null,
  };
}

/**
 * Build user context for the AI
 */
async function buildUserContext(userId: string): Promise<string> {
  const db = getDb();

  // Get user profile
  const profile = await db
    .select()
    .from(userProfiles)
    .where(eq(userProfiles.userId, userId))
    .get();

  // Get accounts
  const userAccounts = await db
    .select()
    .from(accounts)
    .where(eq(accounts.userId, userId))
    .all();

  // Get recent transactions (last 50 transactions)
  const recentTxns = await db
    .select()
    .from(transactions)
    .where(eq(transactions.userId, userId))
    .orderBy(desc(transactions.date))
    .limit(50)
    .all();

  // Get debts
  const userDebts = await db
    .select()
    .from(debts)
    .where(eq(debts.userId, userId))
    .all();

  // Get scheduled bills
  const bills = await db
    .select()
    .from(scheduledBills)
    .where(eq(scheduledBills.userId, userId))
    .all();

  // Get current decision state
  const decision = await db
    .select()
    .from(decisionState)
    .where(eq(decisionState.userId, userId))
    .orderBy(desc(decisionState.createdAt))
    .get();

  // Build context string
  const context = `
[ESTADO FINANCIERO ACTUAL]

Perfil:
- Salario mensual: ${profile?.monthlySalaryCents ? `$${(profile.monthlySalaryCents / 100).toFixed(2)}` : 'No especificado'}
- Frecuencia de pago: ${profile?.payFrequency || 'No especificada'}

Cuentas: ${userAccounts.length > 0 ? userAccounts.map((a) => `${a.name} (${a.type})`).join(', ') : 'Ninguna'}

Transacciones recientes (últimos 30 días): ${recentTxns.length} transacciones
${recentTxns
  .slice(0, 10)
  .map(
    (t) =>
      `- ${t.description}: $${(Math.abs(t.amountCents) / 100).toFixed(2)} (${t.type})`
  )
  .join('\n')}
${recentTxns.length > 10 ? `... y ${recentTxns.length - 10} más` : ''}

Deudas: ${userDebts.length > 0 ? userDebts.map((d) => `${d.name}: $${(d.currentBalanceCents / 100).toFixed(2)}`).join(', ') : 'Ninguna'}

Gastos fijos mensuales: ${bills.length > 0 ? bills.map((b) => `${b.name}: $${(b.amountCents / 100).toFixed(2)}`).join(', ') : 'Ninguno'}

Decisión actual: ${decision ? `${decision.riskLevel} - ${decision.primaryCommandText}` : 'No hay decisión activa'}
`;

  return context;
}

/**
 * Process a message from the user
 */
export async function processAdvisorMessage(
  userId: string,
  sessionId: string,
  message: string,
  fileContext?: { fileId: string; summary: string }
): Promise<{
  reply: string;
  classification: AdvisorAIResponse['classification'];
  pendingChanges: PendingChanges | null;
  requiresConfirmation: boolean;
  confirmationPrompt: string | null;
  suggestedNextAction: AdvisorAIResponse['suggestedNextAction'];
}> {
  const db = getDb();

  // Get session
  const session = await db
    .select()
    .from(advisorSessions)
    .where(eq(advisorSessions.id, sessionId))
    .get();

  if (!session) {
    throw new Error('Session not found');
  }

  // Build conversation history for AI
  const history: AdvisorMessage[] = session.conversationHistory
    ? JSON.parse(session.conversationHistory)
    : [];

  // Get user context
  const userContext = await buildUserContext(userId);

  // Build messages for Claude
  const messages: Anthropic.MessageParam[] = history.slice(-10).map((msg) => ({
    role: msg.role,
    content: msg.content,
  }));

  // Add current message
  let userMessageContent = message;
  if (fileContext) {
    userMessageContent = `[DOCUMENTO SUBIDO]
Resumen del archivo: ${fileContext.summary}

Mensaje del usuario: ${message || 'Subí este archivo.'}`;
  }

  messages.push({
    role: 'user',
    content: userMessageContent,
  });

  // Call Claude
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    system: `${ADVISOR_SYSTEM_PROMPT}

${userContext}`,
    messages,
  });

  // Parse response
  const responseText =
    response.content[0].type === 'text' ? response.content[0].text : '';

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
  } catch (e) {
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

  // Update session
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

  return {
    reply: aiResponse.reply,
    classification: aiResponse.classification,
    pendingChanges: aiResponse.pendingChanges,
    requiresConfirmation: aiResponse.requiresConfirmation,
    confirmationPrompt: aiResponse.confirmationPrompt,
    suggestedNextAction: aiResponse.suggestedNextAction,
  };
}

/**
 * Confirm and commit pending changes
 * This is the ONLY place where data gets written to the database
 */
export async function confirmPendingChanges(
  userId: string,
  sessionId: string
): Promise<{
  success: boolean;
  changesApplied: string[];
  decisionRecomputed: boolean;
  error?: string;
}> {
  const db = getDb();

  // Get session
  const session = await db
    .select()
    .from(advisorSessions)
    .where(eq(advisorSessions.id, sessionId))
    .get();

  if (!session || !session.pendingChanges) {
    return {
      success: false,
      changesApplied: [],
      decisionRecomputed: false,
      error: 'No hay cambios pendientes para confirmar.',
    };
  }

  const changes: PendingChanges = JSON.parse(session.pendingChanges);
  const changesApplied: string[] = [];

  try {
    // Get default account for transactions
    const defaultAccount = await db
      .select()
      .from(accounts)
      .where(eq(accounts.userId, userId))
      .limit(1)
      .get();

    // Apply transactions
    if (changes.transactions) {
      for (const txn of changes.transactions) {
        await db.insert(transactions).values({
          id: nanoid(),
          userId,
          accountId: defaultAccount?.id || null,
          date: txn.date,
          description: txn.description,
          amountCents:
            txn.type === 'expense'
              ? -Math.abs(txn.amountCents)
              : Math.abs(txn.amountCents),
          type: txn.type,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
        changesApplied.push(
          `Transacción: ${txn.description} $${(txn.amountCents / 100).toFixed(2)}`
        );
      }
    }

    // Apply transaction updates
    if (changes.transactionUpdates) {
      for (const update of changes.transactionUpdates) {
        await db
          .update(transactions)
          .set({
            ...update.updates,
            updatedAt: Date.now(),
          })
          .where(
            and(
              eq(transactions.id, update.transactionId),
              eq(transactions.userId, userId)
            )
          );
        changesApplied.push(`Transacción actualizada: ${update.transactionId}`);
      }
    }

    // Apply transaction deletions (soft delete by marking as disputed)
    if (changes.transactionDeletions) {
      for (const txnId of changes.transactionDeletions) {
        await db
          .update(transactions)
          .set({
            description: '[DISPUTADA] ' + txnId,
            updatedAt: Date.now(),
          })
          .where(
            and(eq(transactions.id, txnId), eq(transactions.userId, userId))
          );
        changesApplied.push(`Transacción disputada: ${txnId}`);
      }
    }

    // Apply income changes
    if (changes.incomeChange) {
      await db
        .update(userProfiles)
        .set({
          monthlySalaryCents: changes.incomeChange.amountCents,
          updatedAt: Date.now(),
        })
        .where(eq(userProfiles.userId, userId));
      changesApplied.push(
        `Ingreso actualizado: $${(changes.incomeChange.amountCents / 100).toFixed(2)}`
      );
    }

    // Apply debt changes
    if (changes.debtChanges) {
      for (const debtChange of changes.debtChanges) {
        if (debtChange.debtId) {
          // Update existing debt
          await db
            .update(debts)
            .set({
              currentBalanceCents: debtChange.currentBalanceCents,
              minimumPaymentCents: debtChange.minimumPaymentCents,
              aprPercent: debtChange.aprPercent,
              updatedAt: Date.now(),
            })
            .where(
              and(eq(debts.id, debtChange.debtId), eq(debts.userId, userId))
            );
          changesApplied.push(
            `Deuda actualizada: ${debtChange.name || debtChange.debtId}`
          );
        } else {
          // Create new debt
          await db.insert(debts).values({
            id: nanoid(),
            userId,
            name: debtChange.name || 'Nueva deuda',
            type: debtChange.type || 'other',
            currentBalanceCents: debtChange.currentBalanceCents || 0,
            minimumPaymentCents: debtChange.minimumPaymentCents || 0,
            aprPercent: debtChange.aprPercent || 0,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          });
          changesApplied.push(`Nueva deuda: ${debtChange.name}`);
        }
      }
    }

    // Apply bill changes
    if (changes.billChanges) {
      for (const billChange of changes.billChanges) {
        if (billChange.billId) {
          await db
            .update(scheduledBills)
            .set({
              amountCents: billChange.amountCents,
              dueDay: billChange.dueDay,
              isActive: billChange.isActive,
              updatedAt: Date.now(),
            })
            .where(
              and(
                eq(scheduledBills.id, billChange.billId),
                eq(scheduledBills.userId, userId)
              )
            );
          changesApplied.push(
            `Gasto fijo actualizado: ${billChange.name || billChange.billId}`
          );
        } else {
          await db.insert(scheduledBills).values({
            id: nanoid(),
            userId,
            name: billChange.name || 'Nuevo gasto',
            amountCents: billChange.amountCents || 0,
            dueDay: billChange.dueDay || 1,
            frequency: billChange.frequency || 'monthly',
            isActive: true,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          });
          changesApplied.push(`Nuevo gasto fijo: ${billChange.name}`);
        }
      }
    }

    // Check if we should recompute decision
    const shouldRecompute = shouldRecomputeDecision(changes);

    // Update session - clear pending changes, mark as confirmed
    await db
      .update(advisorSessions)
      .set({
        pendingChanges: null,
        lastConfirmedAt: Date.now(),
        lastDecisionRecompute: shouldRecompute
          ? Date.now()
          : session.lastDecisionRecompute,
        lastActivityAt: Date.now(),
      })
      .where(eq(advisorSessions.id, sessionId));

    return {
      success: true,
      changesApplied,
      decisionRecomputed: shouldRecompute,
    };
  } catch (error) {
    console.error('Failed to confirm pending changes:', error);
    return {
      success: false,
      changesApplied,
      decisionRecomputed: false,
      error: 'Error al aplicar cambios. Intenta de nuevo.',
    };
  }
}

/**
 * Clear pending changes (user cancelled)
 */
export async function clearPendingChanges(sessionId: string): Promise<void> {
  const db = getDb();

  await db
    .update(advisorSessions)
    .set({
      pendingChanges: null,
      lastActivityAt: Date.now(),
    })
    .where(eq(advisorSessions.id, sessionId));
}
