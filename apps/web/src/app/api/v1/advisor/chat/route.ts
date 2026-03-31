import { NextRequest, NextResponse } from 'next/server';
import { eq, and } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import {
  advisorSessions,
  categories as categoriesTable,
} from '@/lib/db/schema';
import { getAuthenticatedUser } from '@/lib/api/auth';
import { errorJson } from '@/lib/api/utils';
import Anthropic from '@anthropic-ai/sdk';
import { nanoid } from 'nanoid';
import {
  enrichTransactions,
  enrichTransactionsWithLearning,
} from '@/lib/import-pipeline';
import type { ParsedBankStatement } from '@/lib/file-upload/types';
import type {
  DocumentContext,
  EnrichmentResult,
} from '@/lib/import-pipeline/types';

export const dynamic = 'force-dynamic';

// Initialize Anthropic client
const anthropic = new Anthropic();

// System prompt - LOCKED, do not modify
const ADVISOR_SYSTEM_PROMPT = `You are BudgetCopilot's Financial Advisor — a sharp, confident professional who genuinely cares about the user's financial health.

Your role: help the user UPDATE their financial reality (income, expenses, debts) and UNDERSTAND their situation. You also proactively observe patterns, flag concerns, and celebrate wins.

PERSONALITY & TONE:
- You are a seasoned financial advisor with a dry wit. Think: the friend who works in finance and tells it like it is over coffee.
- Professional but warm. You care, and it shows — sometimes through a well-placed quip.
- A little sassy when the numbers call for it. If someone spent $200 on coffee this month, you notice. You don't lecture — you raise an eyebrow.
- Never mean, never condescending, never preachy. The sass comes from a place of "I'm rooting for you."
- Short, punchy sentences. No fluff. No corporate speak. No "Great question!" filler.
- You can use light humor when appropriate, but never at the expense of clarity.
- No emojis.

EXAMPLES OF YOUR VOICE:
- "Three Uber Eats orders in two days. Bold strategy."
- "Good news: your income is up 12% this month. Bad news: so are your expenses."
- "That subscription you forgot about? It didn't forget about you. $14.99, right on schedule."
- "Solid month. You actually spent less than you earned. I'm proud of us."
- "I see a $500 charge at [store]. Not judging — just making sure it's yours."

NEVER DO:
- Shame, guilt-trip, or moralize about spending choices
- Be passive-aggressive or sarcastic in a hurtful way
- Give unsolicited financial advice or payment strategies (unless asked)
- Change data without asking first
- Present assumptions as facts
- Use phrases like "You should...", "The best thing is...", "I highly recommend..."

YOU MAY:
- Ask clarifying questions
- Summarize what the user said concisely
- Detect inconsistencies and flag them with personality ("Hmm, your rent went up $200 but your income didn't. Worth a look?")
- Propose a draft of changes for confirmation
- Point out spending patterns you notice — factually, with a light touch
- Celebrate good financial behavior genuinely
- Simulate scenarios if the user asks ("what if...?")

INTERACTION TYPES (CLASSIFY EACH MESSAGE):
1) UPDATE:
   E.g.: "I got paid", "I forgot an expense", "I have a new receipt", "I uploaded a bank statement"
   -> Extract proposed changes in pendingChanges.
   -> Ask for confirmation before applying.
2) QUESTION:
   E.g.: "why am I spending so much?", "where does my money go?"
   -> Respond with a brief factual explanation based on available data, with your characteristic directness.
   -> If a missing piece of data is needed, ask 1 specific question.
3) CORRECTION / DISPUTE:
   E.g.: "that expense is wrong", "that transaction isn't mine"
   -> Identify the item (ask for date/amount if needed).
   -> Propose correction in pendingChanges and ask for confirmation.
4) DOCUMENT:
   User uploads PDF/CSV/XLSX/image
   -> Summarize findings concisely with any notable observations.
   -> Propose import in pendingChanges.
   -> Ask for confirmation before importing.

OUTPUT FORMAT (ALWAYS JSON):
Always return a JSON object with:
- reply: string (text to user)
- classification: "update" | "question" | "correction" | "document"
- pendingChanges: object | null
- requiresConfirmation: boolean
- confirmationPrompt: string | null
- suggestedNextAction: "none" | "confirm_changes" | "upload_more" | "recompute_decision"
- confidence: "high" | "medium" | "low"

RULES:
- If pendingChanges exists, requiresConfirmation must be true and confirmationPrompt cannot be null.
- Never confirm on behalf of the user.
- If there is ambiguity, ask a single specific question and continue.
- Keep the response between 1 and 6 lines.`;

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
async function processFileContext(
  fileId: string,
  summaryJson: string,
  userCategories?: Array<{
    id: string;
    name: string;
    parentId: string | null;
    emoji?: string | null;
  }>,
  userId?: string
): Promise<{
  enrichment: EnrichmentResult;
  documentContext: DocumentContext;
  humanSummary: string;
} | null> {
  try {
    const parsed = JSON.parse(summaryJson);

    // Check if it's a bank statement
    if (parsed.documentType !== 'bank_statement' || !parsed.transactions) {
      return null;
    }

    const bankStatement = parsed as ParsedBankStatement;

    // Run enrichment: use learning enricher if we have userId + categories
    const enrichment =
      userId && userCategories
        ? await enrichTransactionsWithLearning(
            bankStatement.transactions,
            userCategories,
            userId
          )
        : enrichTransactions(bankStatement.transactions, userCategories);

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
      parts.push(`Period: ${stats.dateRange.from} to ${stats.dateRange.to}`);
    }

    // Counts
    parts.push(`${stats.totalCount} transactions total`);
    parts.push(
      `${stats.expenseCount} expenses (${formatAmount(stats.totalExpenseCents)})`
    );
    parts.push(
      `${stats.incomeCount} income (${formatAmount(stats.totalIncomeCents)})`
    );

    if (stats.transferCount > 0) {
      parts.push(`${stats.transferCount} transfers detected`);
    }

    if (stats.uncategorizedCount > 0) {
      parts.push(`${stats.uncategorizedCount} uncategorized`);
    }

    if (stats.microFeeCount > 0) {
      parts.push(`${stats.microFeeCount} micro-charges (< $1)`);
    }

    // Add top expenses (sorted by amount descending)
    const expenses = transactions
      .filter((tx) => !tx.isCredit && !tx.isTransfer)
      .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));

    if (expenses.length > 0) {
      const topExpenses = expenses.slice(0, 10);
      parts.push('\n\nLARGEST EXPENSES:');
      topExpenses.forEach((tx, i) => {
        const category = tx.category.name || 'Uncategorized';
        parts.push(
          `${i + 1}. ${tx.date || 'No date'} - ${tx.description} - ${formatAmountRaw(tx.amount)} (${category})`
        );
      });
    }

    // Add top income (sorted by amount descending)
    const income = transactions
      .filter((tx) => tx.isCredit && !tx.isTransfer)
      .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));

    if (income.length > 0) {
      const topIncome = income.slice(0, 5);
      parts.push('\n\nLARGEST INCOME:');
      topIncome.forEach((tx, i) => {
        const category = tx.category.name || 'Uncategorized';
        parts.push(
          `${i + 1}. ${tx.date || 'No date'} - ${tx.description} - ${formatAmountRaw(tx.amount)} (${category})`
        );
      });
    }

    // Add spending by category summary
    const categoryTotals = new Map<string, number>();
    for (const tx of transactions) {
      if (!tx.isCredit && !tx.isTransfer) {
        const catName = tx.category.name || 'Uncategorized';
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

      parts.push('\n\nSPENDING BY CATEGORY:');
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
    const [session] = await db
      .select()
      .from(advisorSessions)
      .where(
        and(
          eq(advisorSessions.id, sessionId),
          eq(advisorSessions.userId, user.id)
        )
      );

    if (!session) {
      return errorJson('NOT_FOUND', 'Session not found', 404);
    }

    // Parse conversation history
    const history: AdvisorMessage[] = session.conversationHistory
      ? JSON.parse(session.conversationHistory)
      : [];

    // Process file context if present
    let documentContext: DocumentContext | null = null;
    let fileProcessingResult: Awaited<ReturnType<typeof processFileContext>> =
      null;

    if (fileContext) {
      // Fetch user categories for auto-assignment
      const userCategories = await db
        .select({
          id: categoriesTable.id,
          name: categoriesTable.name,
          parentId: categoriesTable.parentId,
          emoji: categoriesTable.emoji,
        })
        .from(categoriesTable)
        .where(eq(categoriesTable.userId, auth.user.id));

      fileProcessingResult = await processFileContext(
        fileContext.fileId,
        fileContext.summary,
        userCategories,
        auth.user.id
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
        userMessageContent = `[UPLOADED DOCUMENT]
File summary: ${fileProcessingResult.humanSummary}

User message: ${message || 'I uploaded this file.'}`;
      } else {
        // Fallback to raw summary if processing failed
        userMessageContent = `[UPLOADED DOCUMENT]
File summary: ${fileContext.summary}

User message: ${message || 'I uploaded this file.'}`;
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
