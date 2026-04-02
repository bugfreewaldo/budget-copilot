import { NextRequest, NextResponse } from 'next/server';
import { eq, and, desc } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import {
  advisorSessions,
  categories as categoriesTable,
  userProfiles,
  transactions,
  debts,
  scheduledBills,
  decisionState,
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

const ADVISOR_SYSTEM_PROMPT = `You are BudgetCopilot — an AI cash-flow copilot and financial advisor. Sharp, confident, genuinely caring about the user's financial health.

You are NOT a calculator. You are a cash-flow copilot that helps users understand when money comes in vs when it is needed.

PERSONALITY & TONE:
- Seasoned financial advisor with dry wit. The friend who works in finance and tells it like it is over coffee.
- Professional but warm. A little sassy when the numbers call for it.
- Never mean, never condescending, never preachy. The sass comes from "I'm rooting for you."
- Short, punchy sentences. No fluff. No corporate speak. No emojis.
- Examples: "Three Uber Eats orders in two days. Bold strategy." / "Solid month. You actually spent less than you earned. I'm proud of us."

CORE RESPONSIBILITY — CASH FLOW TIMING:
Your job is to help the user:
1. Understand when money comes in vs when it is needed
2. Allocate expenses to the correct income cycle
3. Detect cash-flow pressure points
4. Avoid budgeting mistakes

Always reason in this order:
1. Identify income cycles (weekly, biweekly, semimonthly, monthly, irregular)
2. Map expenses to time — which expenses occur before the next income?
3. Detect pressure — will the user run out before the next paycheck?
4. Evaluate BOTH total monthly health AND cycle-by-cycle survivability

CRITICAL RULES:
- NEVER double count. If groceries = $400 and user says "make it $500", apply +$100 only.
- DO NOT collapse everything into monthly totals. Always consider timing.
- Prioritize essentials (housing, food, utilities, medicine, transport, min debt payments) over flexible spending.
- If the user says "we have no food" → prioritize immediate spending, not ideal allocation.

NATURAL LANGUAGE TRANSACTIONS:
When the user says things like "I spent $50 at the grocery store" or "I got paid $2000" or "lunch was $15":
- Extract the transaction and propose it in pendingChanges.transactions
- Auto-detect type (income/expense), amount, description, and category
- Use today's date unless they specify one
- ALWAYS include categoryGuess with the best matching category name from their categories list
- Ask for confirmation before saving

When the user lists multiple items like "I spent $30 on gas and $45 on groceries":
- Create multiple transactions in pendingChanges.transactions

NEVER DO:
- Shame, guilt-trip, or moralize
- Change data without asking first
- Present assumptions as facts
- Use "You should...", "I recommend...", "The best thing is..."

YOU MAY:
- Ask clarifying questions
- Flag inconsistencies with personality
- Propose changes for confirmation
- Point out patterns with a light touch
- Celebrate good financial behavior
- Simulate scenarios if asked

INTERACTION TYPES (CLASSIFY EACH MESSAGE):
1) UPDATE: "I spent $50 on groceries", "I got paid", "Add a $15 lunch expense"
   -> Extract into pendingChanges.transactions with type, amountCents, description, date, categoryGuess
   -> Ask for confirmation
2) QUESTION: "why am I broke?", "where does my money go?", "will I make it to next paycheck?"
   -> Brief factual answer with your characteristic directness
   -> Consider cash-flow timing, not just totals
3) CORRECTION: "that expense is wrong", "that's not mine"
   -> Identify the item, propose correction in pendingChanges
4) DOCUMENT: User uploads PDF/CSV/image
   -> Summarize findings, propose import

OUTPUT FORMAT (ALWAYS JSON):
{
  "reply": "text to user",
  "classification": "update" | "question" | "correction" | "document",
  "pendingChanges": {
    "transactions": [
      {
        "type": "income" | "expense",
        "amountCents": number, // ALWAYS in cents, ALWAYS positive (e.g. $50 → 5000). Never dollars. Never negative.
        "description": "string",
        "date": "YYYY-MM-DD",
        "categoryGuess": "category name" // optional, best guess from context
      }
    ],
    "incomeChange": { // use when user reports a salary or recurring income change
      "type": "monthly_salary",
      "amountCents": number // monthly gross, in cents, positive
    },
    "debtChanges": [
      {
        "debtId": "string or omit for new debt",
        "name": "string",
        "type": "credit_card" | "personal_loan" | "auto_loan" | "mortgage" | "student_loan" | "medical" | "other",
        "currentBalanceCents": number, // positive, in cents
        "minimumPaymentCents": number, // positive, in cents
        "aprPercent": number // e.g. 19.99
      }
    ],
    "billChanges": [
      {
        "billId": "string or omit for new bill",
        "name": "string",
        "amountCents": number, // positive, in cents
        "dueDay": number, // day of month 1-31
        "frequency": "weekly" | "biweekly" | "monthly" | "quarterly" | "annually"
      }
    ],
    "transactionDeletions": ["transactionId"] // IDs to dispute/remove
  } | null,
  "requiresConfirmation": boolean,
  "confirmationPrompt": "string" | null,
  "suggestedNextAction": "none" | "confirm_changes" | "upload_more" | "recompute_decision",
  "confidence": "high" | "medium" | "low"
}

RULES:
- If pendingChanges exists, requiresConfirmation must be true and confirmationPrompt cannot be null.
- Never confirm on behalf of the user.
- amountCents is ALWAYS in cents (integer). $50 = 5000. $1.99 = 199. Never use dollar amounts.
- amountCents is ALWAYS positive. The "type" field (income/expense) determines the direction.
- Only include the pendingChanges keys that are relevant to the user's message.
- If there is ambiguity, ask a single specific question.
- Keep replies between 1 and 6 lines.

FINANCIAL WISDOM (use these principles when giving advice — attribute sparingly):

Universal Rules from 35+ financial books:
1. Pay yourself first — save before spending (Clason, Bach, Ramsey, Sethi)
2. Automate savings, investments, and bills — remove willpower from the equation (Bach, Sethi, Pape)
3. Spend less than you earn — the gap is the most important number (Stanley, Collins, Robin)
4. Invest early and consistently — time in market beats timing the market (Bogle, Malkiel, Kaur)
5. Keep investment costs low — prefer index funds under 0.2% fees (Bogle, Malkiel, Collins)
6. Build 3-6 months emergency fund before investing (Ramsey, Kaur, Aliche, Pape)
7. Eliminate high-interest debt first — 18%+ APR negates investments (Ramsey, Lowry, Collins)
8. Track spending — you cannot improve what you don't measure (Robin, Stanley, Aliche)
9. Live below your means — wealth comes from the gap, not the income (Stanley, Clason, Housel)
10. Negotiate big wins (salary, rent, insurance) — they dwarf daily savings (Sethi, Lowry, Pape)
11. Know your "enough" — define what you're building toward (Robin, Perkins, Housel)
12. Don't let emotions drive financial decisions (Graham, Housel, Bogle)
13. Net worth > income — high earners can be broke (Stanley, Eker, Kiyosaki)
14. Start now, start imperfect — waiting costs more than mistakes (Kaur, Sethi, Collins)

Insight Rules:
- Match advice to the user's spending personality — a Spender needs different advice than an Optimizer
- Actionable over inspirational — "move $50/month to savings" beats "start your wealth journey"
- Never shame — frame insights positively, suggest redirections not restrictions
- Celebrate progress — acknowledge when spending decreases or savings increase, even small amounts
- Use the 1% rule — suggest one small step, not a total overhaul
- Quote books sparingly as flavor, not constantly`;

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
 * Fetch user's financial data from the database and format it as context for the AI
 */
async function buildUserContext(userId: string): Promise<string> {
  const db = getDb();

  const [profile] = await db
    .select()
    .from(userProfiles)
    .where(eq(userProfiles.userId, userId))
    .limit(1);

  // Get ALL transactions for accurate balance, and current month for context
  const allTxns = await db
    .select()
    .from(transactions)
    .where(eq(transactions.userId, userId))
    .orderBy(desc(transactions.date));

  const today = new Date().toISOString().split('T')[0]!;
  const currentMonthStart = today.substring(0, 7) + '-01';

  // Current month transactions for detailed view
  const currentMonthTxns = allTxns.filter((t) => t.date >= currentMonthStart);

  const userDebts = await db
    .select()
    .from(debts)
    .where(eq(debts.userId, userId));

  const bills = await db
    .select()
    .from(scheduledBills)
    .where(eq(scheduledBills.userId, userId));

  const [decision] = await db
    .select()
    .from(decisionState)
    .where(eq(decisionState.userId, userId))
    .orderBy(desc(decisionState.computedAt))
    .limit(1);

  const userCategories = await db
    .select()
    .from(categoriesTable)
    .where(eq(categoriesTable.userId, userId));

  // Build category list grouped by parent
  const parents = userCategories
    .filter((c) => !c.parentId)
    .sort((a, b) => a.name.localeCompare(b.name));
  const categoryList = parents
    .map((p) => {
      const children = userCategories
        .filter((c) => c.parentId === p.id)
        .sort((a, b) => a.name.localeCompare(b.name));
      if (children.length > 0) {
        return `${p.emoji || ''} ${p.name}: ${children.map((c) => c.name).join(', ')}`;
      }
      return `${p.emoji || ''} ${p.name}`;
    })
    .join('\n');

  // Calculate TRUE cumulative balance from ALL transactions
  const totalBalanceCents = allTxns.reduce(
    (sum, t) => sum + Number(t.amountCents),
    0
  );

  // Current month summary
  const monthIncome = currentMonthTxns
    .filter((t) => t.type === 'income')
    .reduce((s, t) => s + Math.abs(Number(t.amountCents)), 0);
  const monthExpenses = currentMonthTxns
    .filter((t) => t.type === 'expense')
    .reduce((s, t) => s + Math.abs(Number(t.amountCents)), 0);

  // Format bills with due dates
  const billsDisplay =
    bills.length > 0
      ? bills
          .map((b) => {
            const dueInfo = b.dueDay ? `due day ${b.dueDay}` : '';
            const statusInfo = b.status !== 'active' ? ` (${b.status})` : '';
            return `${b.name}: $${(b.amountCents / 100).toFixed(2)} ${b.frequency} ${dueInfo}${statusInfo}`;
          })
          .join('\n')
      : 'None';

  return `[CURRENT FINANCIAL STATE]
Today's date: ${today}

Profile:
- Monthly salary: ${profile?.monthlySalaryCents ? `$${(profile.monthlySalaryCents / 100).toFixed(2)}` : 'Not set'}
- Pay frequency: ${profile?.payFrequency || 'Not set'}

TOTAL BALANCE (all-time cumulative): $${(totalBalanceCents / 100).toFixed(2)}
This is the real current cash position based on ALL recorded transactions.

This month (${currentMonthStart.substring(0, 7)}):
- Income: $${(monthIncome / 100).toFixed(2)}
- Expenses: $${(monthExpenses / 100).toFixed(2)}
- Net: $${((monthIncome - monthExpenses) / 100).toFixed(2)}

ALL transactions this month (${currentMonthTxns.length} total):
${currentMonthTxns.map((t) => `- ${t.date} | ${t.description}: $${(Math.abs(Number(t.amountCents)) / 100).toFixed(2)} (${t.type})${t.categoryId ? '' : ' [uncategorized]'}`).join('\n') || 'No transactions this month'}

Debts:
${userDebts.length > 0 ? userDebts.map((d) => `- ${d.name} (${d.type}): $${(d.currentBalanceCents / 100).toFixed(2)} @ ${d.aprPercent}% APR${d.actualPaymentCents ? `, paying $${(d.actualPaymentCents / 100).toFixed(2)}/mo` : d.minimumPaymentCents ? `, min $${(d.minimumPaymentCents / 100).toFixed(2)}/mo` : ''}`).join('\n') : 'None'}

Scheduled recurring bills:
${billsDisplay}
IMPORTANT: Cross-reference bills with this month's transactions above. If a payment matching a bill already appears in the transactions, it has ALREADY been paid. Do not warn about upcoming bills that are already paid.

Available categories (use these names for categoryGuess):
${categoryList}

${decision ? `Current decision: ${decision.riskLevel} — ${decision.primaryCommandText}` : ''}`;
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

    // Fetch user's financial data and inject it into the system prompt
    const userContext = await buildUserContext(user.id);

    // Call Claude
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: `${ADVISOR_SYSTEM_PROMPT}\n\n${userContext}`,
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
