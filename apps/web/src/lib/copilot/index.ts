/**
 * Budget Copilot - AI-Powered Financial Agent
 *
 * A truly intelligent conversational AI agent powered by Claude that helps users:
 * - Register income and expenses through natural language
 * - Track and manage debts with smart strategies
 * - Get proactive financial advice and insights
 * - Have real conversations about finances
 *
 * Personality: Friendly, sassy, encouraging - like a smart friend who's good with money
 */

import Anthropic from '@anthropic-ai/sdk';
import { nanoid } from 'nanoid';
import { eq, and, desc, gte } from 'drizzle-orm';
import { getDb } from '../db/client';
import {
  categories,
  transactions,
  accounts,
  debts,
  userProfiles,
} from '../db/schema';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface ExtractedTransaction {
  amountCents: number;
  description: string;
  merchant: string | null;
  date: string;
  categoryId: string | null;
  categoryName: string | null;
  type: 'income' | 'expense';
  notes: string | null;
}

export interface CopilotResponse {
  message: string;
  transaction?: ExtractedTransaction;
  transactionCreated?: boolean;
  transactionId?: string;
  suggestedCategories?: Array<{
    id: string;
    name: string;
    emoji: string | null;
  }>;
  needsMoreInfo?: boolean;
  missingFields?: string[];
  needsCategoryConfirmation?: boolean;
  categoryOptions?: Array<{ name: string; emoji: string }>;
  pendingTransaction?: Partial<ExtractedTransaction>;
  intent?: ConversationIntent;
  insights?: FinancialInsight[];
  debtCreated?: boolean;
  debtId?: string;
  followUpActions?: FollowUpAction[];
}

export type ConversationIntent =
  | 'greeting'
  | 'transaction'
  | 'debt_register'
  | 'debt_inquiry'
  | 'balance_inquiry'
  | 'spending_summary'
  | 'help'
  | 'conversation'
  | 'unknown';

export interface FinancialInsight {
  type: 'tip' | 'warning' | 'achievement' | 'recommendation';
  message: string;
  priority: 'low' | 'medium' | 'high';
}

export interface FollowUpAction {
  label: string;
  type: 'quick_reply' | 'action_button';
  value: string;
}

// AI Response structure from Claude
interface AIDecision {
  intent: ConversationIntent;
  message: string;
  action?: {
    type:
      | 'create_transaction'
      | 'create_debt'
      | 'show_summary'
      | 'show_debts'
      | 'none';
    data?: {
      // Transaction data
      amountCents?: number;
      description?: string;
      type?: 'income' | 'expense';
      categoryName?: string;
      categoryEmoji?: string;
      date?: string;
      // Debt data
      debtName?: string;
      debtType?: string;
      aprPercent?: number;
      minimumPaymentCents?: number;
    };
  };
  followUpActions?: Array<{ label: string; value: string }>;
  needsMoreInfo?: boolean;
  missingFields?: string[];
}

// ============================================================================
// CLAUDE AI CLIENT
// ============================================================================

let anthropicClient: Anthropic | null = null;

function getAnthropicClient(): Anthropic {
  if (!anthropicClient) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error(
        'ANTHROPIC_API_KEY is not configured. Please set it in your environment variables.'
      );
    }
    anthropicClient = new Anthropic({ apiKey });
  }
  return anthropicClient;
}

// ============================================================================
// FINANCIAL CONTEXT BUILDER
// ============================================================================

interface FinancialContext {
  categories: Array<{ id: string; name: string; emoji: string | null }>;
  recentTransactions: Array<{
    description: string;
    amountCents: number;
    type: string;
    categoryName: string | null;
    date: string;
  }>;
  monthlyStats: {
    totalIncome: number;
    totalExpenses: number;
    balance: number;
    transactionCount: number;
  };
  debts: Array<{
    name: string;
    currentBalanceCents: number;
    aprPercent: number;
    type: string;
  }>;
  profile: {
    monthlySalaryCents: number | null;
    copilotTone: string | null;
  } | null;
}

async function buildFinancialContext(
  userId: string
): Promise<FinancialContext> {
  const db = getDb();

  // Get user's categories
  const userCategories = await db
    .select({
      id: categories.id,
      name: categories.name,
      emoji: categories.emoji,
    })
    .from(categories)
    .where(eq(categories.userId, userId));

  // Get recent transactions (last 10)
  const recentTx = await db
    .select({
      description: transactions.description,
      amountCents: transactions.amountCents,
      type: transactions.type,
      categoryId: transactions.categoryId,
      date: transactions.date,
    })
    .from(transactions)
    .where(eq(transactions.userId, userId))
    .orderBy(desc(transactions.createdAt))
    .limit(10);

  // Map category names to transactions
  const categoryMap = new Map(userCategories.map((c) => [c.id, c.name]));
  const recentTransactions = recentTx.map((tx) => ({
    description: tx.description,
    amountCents: tx.amountCents,
    type: tx.type,
    categoryName: tx.categoryId ? categoryMap.get(tx.categoryId) || null : null,
    date: tx.date,
  }));

  // Get this month's stats
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .split('T')[0]!;

  const monthTx = await db
    .select({
      amountCents: transactions.amountCents,
      type: transactions.type,
    })
    .from(transactions)
    .where(
      and(eq(transactions.userId, userId), gte(transactions.date, startOfMonth))
    );

  const totalIncome = monthTx
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + Math.abs(t.amountCents), 0);
  const totalExpenses = monthTx
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + Math.abs(t.amountCents), 0);

  // Get active debts
  const userDebts = await db
    .select({
      name: debts.name,
      currentBalanceCents: debts.currentBalanceCents,
      aprPercent: debts.aprPercent,
      type: debts.type,
    })
    .from(debts)
    .where(and(eq(debts.userId, userId), eq(debts.status, 'active')));

  // Get user profile
  const [profile] = await db
    .select({
      monthlySalaryCents: userProfiles.monthlySalaryCents,
      copilotTone: userProfiles.copilotTone,
    })
    .from(userProfiles)
    .where(eq(userProfiles.userId, userId));

  return {
    categories: userCategories,
    recentTransactions,
    monthlyStats: {
      totalIncome,
      totalExpenses,
      balance: totalIncome - totalExpenses,
      transactionCount: monthTx.length,
    },
    debts: userDebts,
    profile: profile || null,
  };
}

// ============================================================================
// SYSTEM PROMPT
// ============================================================================

function buildSystemPrompt(context: FinancialContext): string {
  const categoryList =
    context.categories.length > 0
      ? context.categories.map((c) => `${c.emoji || '📦'} ${c.name}`).join(', ')
      : 'No categories yet';

  const recentTxList =
    context.recentTransactions.length > 0
      ? context.recentTransactions
          .slice(0, 5)
          .map(
            (t) =>
              `- ${t.description}: $${(Math.abs(t.amountCents) / 100).toFixed(2)} (${t.type})`
          )
          .join('\n')
      : 'No recent transactions';

  const debtList =
    context.debts.length > 0
      ? context.debts
          .map(
            (d) =>
              `- ${d.name}: $${(d.currentBalanceCents / 100).toFixed(2)} at ${d.aprPercent}% APR`
          )
          .join('\n')
      : 'No debts registered';

  return `You are Budget Copilot, a smart, friendly, and slightly sassy AI financial assistant. You help users track their money through natural conversation in Spanish (Mexico/Latin America style).

## Your Personality
- Friendly and encouraging, like a smart friend who's good with money
- Slightly sassy but never judgmental about spending
- Use casual Spanish (tú, not usted) with occasional English words (very common in Mexico)
- Keep responses concise - 1-3 sentences usually
- Use emojis sparingly but effectively 💰

## User's Financial Context
**Categories available:** ${categoryList}
**This month:** Income: $${(context.monthlyStats.totalIncome / 100).toFixed(2)}, Expenses: $${(context.monthlyStats.totalExpenses / 100).toFixed(2)}, Balance: $${(context.monthlyStats.balance / 100).toFixed(2)}
**Recent transactions:**
${recentTxList}
**Active debts:**
${debtList}
${context.profile?.monthlySalaryCents ? `**Monthly salary:** $${(context.profile.monthlySalaryCents / 100).toFixed(2)}` : ''}

## Your Capabilities
1. **Register transactions** - When user mentions spending or receiving money, extract and register it
2. **Register debts** - When user mentions having debt, extract details and register it
3. **Provide summaries** - Show spending summaries, debt status, etc.
4. **Give advice** - Proactive tips based on their financial situation
5. **Have conversations** - Answer questions about personal finance, their data, etc.

## Response Format
You MUST respond with valid JSON in this exact format:
{
  "intent": "transaction" | "greeting" | "debt_register" | "debt_inquiry" | "spending_summary" | "help" | "conversation" | "unknown",
  "message": "Your response message in Spanish",
  "action": {
    "type": "create_transaction" | "create_debt" | "show_summary" | "show_debts" | "none",
    "data": {
      "amountCents": 5000,
      "description": "Café en Starbucks",
      "type": "expense" | "income",
      "categoryName": "Café",
      "categoryEmoji": "☕",
      "date": "2024-12-04",
      "debtName": "Tarjeta BBVA",
      "debtType": "credit_card",
      "aprPercent": 45,
      "minimumPaymentCents": 50000
    }
  },
  "followUpActions": [
    {"label": "Otro gasto", "value": "Gasté $"}
  ],
  "needsMoreInfo": false,
  "missingFields": []
}

## Important Rules for Transactions
- ALWAYS convert amounts to cents (multiply by 100): $50 = 5000 cents
- For amounts like "$2,400" or "$2400" treat as whole dollars = 240000 cents
- For amounts like "$24.00" or "$24,00" treat as dollars with cents = 2400 cents
- Pick the BEST matching category from the user's existing categories
- If no category matches well, suggest a new one with an appropriate emoji
- Date defaults to today unless user says "ayer" (yesterday) or specifies a date

## Category Intelligence
When categorizing, think about what the purchase actually is:
- "Starbucks", "café", "coffee" → Café ☕
- "Uber", "taxi", "gasolina" → Transporte 🚗
- "Netflix", "Spotify", "Disney+" → Streaming 📺
- "Walmart", "super", "mandado" → Supermercado 🛒
- "restaurante", "comida", "almuerzo" → Restaurantes 🍽️
- "gym", "gimnasio" → Gimnasio 💪
- "quincena", "salario", "sueldo" → Salario 💰
- "freelance", "proyecto" → Freelance 💻

## Debt Types
Map debt mentions to these types:
- "tarjeta" → credit_card
- "préstamo personal" → personal_loan
- "auto/carro" → auto_loan
- "hipoteca/casa" → mortgage
- "estudiante/universidad" → student_loan
- "médico/hospital" → medical
- other → other

Always respond with ONLY the JSON object, no additional text.`;
}

// ============================================================================
// MAIN AI PROCESSOR
// ============================================================================

async function processWithAI(
  userMessage: string,
  context: FinancialContext,
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>
): Promise<AIDecision> {
  const client = getAnthropicClient();

  const messages: Anthropic.MessageParam[] = [
    ...conversationHistory.map((msg) => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
    })),
    { role: 'user', content: userMessage },
  ];

  const response = await client.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 1024,
    system: buildSystemPrompt(context),
    messages,
  });

  const content = response.content[0];
  if (!content || content.type !== 'text') {
    throw new Error('No response from Claude');
  }

  try {
    // Parse the JSON response
    const parsed = JSON.parse(content.text) as AIDecision;
    return parsed;
  } catch {
    // If parsing fails, return a fallback response
    return {
      intent: 'conversation',
      message: content.text,
      action: { type: 'none' },
    };
  }
}

// ============================================================================
// ACTION EXECUTORS
// ============================================================================

async function executeCreateTransaction(
  userId: string,
  data: NonNullable<AIDecision['action']>['data']
): Promise<{
  transactionId: string;
  categoryId: string | null;
  transaction: ExtractedTransaction;
}> {
  const db = getDb();

  if (!data?.amountCents || !data.description || !data.type) {
    throw new Error('Missing required transaction data');
  }

  // Get or create default account
  const userAccounts = await db
    .select()
    .from(accounts)
    .where(eq(accounts.userId, userId));

  let defaultAccount = userAccounts[0];

  if (!defaultAccount) {
    const id = nanoid();
    await db.insert(accounts).values({
      id,
      userId,
      name: 'Efectivo',
      type: 'cash',
      createdAt: Date.now(),
    });
    const [newAccount] = await db
      .select()
      .from(accounts)
      .where(eq(accounts.id, id));
    if (!newAccount) {
      throw new Error('Failed to create default account');
    }
    defaultAccount = newAccount;
  }

  // Find or create category
  let categoryId: string | null = null;
  if (data.categoryName) {
    const userCategories = await db
      .select()
      .from(categories)
      .where(eq(categories.userId, userId));

    const existingCategory = userCategories.find(
      (c) => c.name.toLowerCase() === data.categoryName!.toLowerCase()
    );

    if (existingCategory) {
      categoryId = existingCategory.id;
    } else {
      // Create new category
      const newCategoryId = nanoid();
      await db.insert(categories).values({
        id: newCategoryId,
        userId,
        name: data.categoryName,
        emoji: data.categoryEmoji || '📦',
        createdAt: Date.now(),
      });
      categoryId = newCategoryId;
    }
  }

  // Create transaction
  const transactionId = nanoid();
  const now = Date.now();
  const date =
    data.date || new Date().toISOString().split('T')[0] || '2024-01-01';

  await db.insert(transactions).values({
    id: transactionId,
    userId,
    date,
    description: data.description,
    amountCents:
      data.type === 'expense'
        ? -Math.abs(data.amountCents)
        : Math.abs(data.amountCents),
    type: data.type,
    categoryId,
    accountId: defaultAccount.id,
    cleared: false,
    notes: null,
    createdAt: now,
    updatedAt: now,
  });

  const transaction: ExtractedTransaction = {
    amountCents: data.amountCents,
    description: data.description,
    merchant: null,
    date,
    categoryId,
    categoryName: data.categoryName || null,
    type: data.type,
    notes: null,
  };

  return { transactionId, categoryId, transaction };
}

async function executeCreateDebt(
  userId: string,
  data: NonNullable<AIDecision['action']>['data']
): Promise<{ debtId: string }> {
  const db = getDb();

  if (!data?.amountCents || !data.debtName) {
    throw new Error('Missing required debt data');
  }

  const id = nanoid();
  const now = Date.now();

  // Calculate danger score
  let dangerScore = 0;
  if (data.aprPercent) {
    if (data.aprPercent >= 25) dangerScore += 40;
    else if (data.aprPercent >= 18) dangerScore += 30;
    else if (data.aprPercent >= 12) dangerScore += 20;
    else if (data.aprPercent >= 6) dangerScore += 10;
  }
  const balanceDollars = data.amountCents / 100;
  if (balanceDollars >= 50000) dangerScore += 40;
  else if (balanceDollars >= 20000) dangerScore += 30;
  else if (balanceDollars >= 10000) dangerScore += 20;
  else if (balanceDollars >= 5000) dangerScore += 10;

  const debtType = (data.debtType || 'other') as
    | 'credit_card'
    | 'personal_loan'
    | 'auto_loan'
    | 'mortgage'
    | 'student_loan'
    | 'medical'
    | 'other';

  await db.insert(debts).values({
    id,
    userId,
    name: data.debtName,
    type: debtType,
    originalBalanceCents: data.amountCents,
    currentBalanceCents: data.amountCents,
    aprPercent: data.aprPercent ?? 0,
    minimumPaymentCents: data.minimumPaymentCents || null,
    status: 'active',
    dangerScore: Math.min(100, dangerScore),
    createdAt: now,
    updatedAt: now,
  });

  return { debtId: id };
}

// ============================================================================
// MAIN ENTRY POINT
// ============================================================================

// Simple in-memory conversation store (in production, use Redis or DB)
const conversationStore = new Map<
  string,
  Array<{ role: 'user' | 'assistant'; content: string }>
>();

export async function processMessage(
  userId: string,
  userMessage: string
): Promise<CopilotResponse> {
  try {
    // Build financial context
    const context = await buildFinancialContext(userId);

    // Get conversation history (last 10 messages)
    const history = conversationStore.get(userId) || [];
    const recentHistory = history.slice(-10);

    // Process with AI
    const aiDecision = await processWithAI(userMessage, context, recentHistory);

    // Store conversation
    const newHistory = [
      ...recentHistory,
      { role: 'user' as const, content: userMessage },
      { role: 'assistant' as const, content: aiDecision.message },
    ];
    conversationStore.set(userId, newHistory);

    // Execute action if needed
    let transactionResult: Awaited<
      ReturnType<typeof executeCreateTransaction>
    > | null = null;
    let debtResult: Awaited<ReturnType<typeof executeCreateDebt>> | null = null;

    if (
      aiDecision.action?.type === 'create_transaction' &&
      aiDecision.action.data
    ) {
      try {
        transactionResult = await executeCreateTransaction(
          userId,
          aiDecision.action.data
        );
      } catch (err) {
        console.error('Failed to create transaction:', err);
      }
    }

    if (aiDecision.action?.type === 'create_debt' && aiDecision.action.data) {
      try {
        debtResult = await executeCreateDebt(userId, aiDecision.action.data);
      } catch (err) {
        console.error('Failed to create debt:', err);
      }
    }

    // Build response
    const response: CopilotResponse = {
      message: aiDecision.message,
      intent: aiDecision.intent,
      needsMoreInfo: aiDecision.needsMoreInfo,
      missingFields: aiDecision.missingFields,
      followUpActions: aiDecision.followUpActions?.map((a) => ({
        label: a.label,
        type: 'quick_reply' as const,
        value: a.value,
      })),
    };

    if (transactionResult) {
      response.transaction = transactionResult.transaction;
      response.transactionCreated = true;
      response.transactionId = transactionResult.transactionId;

      // Get suggested categories for quick recategorization
      const userCategories = await getDb()
        .select()
        .from(categories)
        .where(eq(categories.userId, userId));

      response.suggestedCategories = userCategories
        .filter((c) => c.id !== transactionResult!.categoryId)
        .slice(0, 5)
        .map((c) => ({ id: c.id, name: c.name, emoji: c.emoji }));
    }

    if (debtResult) {
      response.debtCreated = true;
      response.debtId = debtResult.debtId;
    }

    return response;
  } catch (error) {
    console.error('Copilot AI error:', error);

    // Fallback to a helpful response if AI fails
    return {
      message: `¡Ups! Tuve un problema procesando tu mensaje. 😅

¿Puedes intentar de nuevo? Puedo ayudarte a:
• Registrar gastos: "Gasté $50 en el super"
• Registrar ingresos: "Me pagaron $2400"
• Ver tu resumen: "¿Cuánto llevo gastado?"`,
      intent: 'unknown',
      followUpActions: [
        { label: 'Registrar gasto', type: 'quick_reply', value: 'Gasté $' },
        {
          label: 'Ver resumen',
          type: 'quick_reply',
          value: '¿Cuánto he gastado?',
        },
      ],
    };
  }
}

// ============================================================================
// UTILITY EXPORTS
// ============================================================================

export async function updateTransactionCategory(
  transactionId: string,
  categoryId: string,
  userId: string
): Promise<boolean> {
  const db = getDb();

  const [tx] = await db
    .select()
    .from(transactions)
    .where(
      and(eq(transactions.id, transactionId), eq(transactions.userId, userId))
    );

  if (!tx) {
    return false;
  }

  await db
    .update(transactions)
    .set({ categoryId, updatedAt: Date.now() })
    .where(eq(transactions.id, transactionId));

  return true;
}

export function getQuickActions(): Array<{ text: string; example: string }> {
  return [
    { text: 'Registrar gasto', example: 'Gasté $30 en almuerzo' },
    { text: 'Compras', example: 'Compré ropa por $150 en Zara' },
    { text: 'Transporte', example: '$15 de Uber' },
    { text: 'Supermercado', example: 'Super $80' },
    { text: 'Ingreso', example: 'Me pagaron mi quincena de $2400' },
    { text: 'Registrar deuda', example: 'Tengo una tarjeta con $5000 al 45%' },
    { text: 'Ver resumen', example: '¿Cuánto he gastado este mes?' },
    { text: 'Ver deudas', example: '¿Cuánto debo en total?' },
  ];
}

// Clear conversation history for a user
export function clearConversationHistory(userId: string): void {
  conversationStore.delete(userId);
}
