/**
 * Budget Copilot - AI-Powered Financial Agent
 *
 * A truly intelligent conversational agent powered by Claude that:
 * - UNDERSTANDS natural language (not just pattern matching)
 * - Has a sassy, friendly personality like a smart friend who's good with money
 * - Can register income/expenses, manage debts, give advice
 * - Makes decisions and takes actions autonomously
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
  scheduledBills,
  // scheduledIncome - will be used for income scheduling feature
} from '../db/schema';

// ============================================================================
// TYPES
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
  intent?: string;
  debtCreated?: boolean;
  debtId?: string;
  followUpActions?: Array<{
    label: string;
    type: 'quick_reply' | 'action_button';
    value: string;
  }>;
}

// ============================================================================
// CLAUDE CLIENT
// ============================================================================

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// ============================================================================
// SYSTEM PROMPT - Context-Aware Budget Copilot
// ============================================================================

const SYSTEM_PROMPT = `You are Budget Copilot, a friendly and direct financial assistant.

CAPABILITIES:
- Record expenses and income when the user mentions them
- View financial summaries
- Help with debts and budgeting
- The user can also UPLOAD PHOTOS of receipts using the camera icon in the chat

FORMATTING RULES (VERY IMPORTANT):
- SHORT responses: 2-3 sentences max
- NEVER use ** for emphasis
- NEVER use complex markdown
- Use emojis sparingly (1-2 per message max)
- Casual and friendly tone, like a friend who's good with money
- Always respond in English

CONTEXT:
- [CURRENT_STATE] contains the user's financial data
- [RELEVANT_HISTORY] contains the recent conversation
- Use this context without asking for it again

EXAMPLES OF GOOD RESPONSES:
- "Done, I recorded $50 in food 🍽️"
- "This month you've spent $1,200. Want to see the breakdown?"
- "That 45% interest debt is rough. You'd better pay it first."

EXAMPLES OF BAD RESPONSES (DON'T DO THIS):
- "**Excellent!** I have recorded your expense of **$50** in the **Food** category..."
- Long paragraphs explaining everything
- Lists with many bullet points

If the user asks about uploading photos, tell them to use the camera icon next to the text field.

Always respond in English.`;

// ============================================================================
// CONVERSATION HISTORY - In-memory storage for context
// ============================================================================

interface ConversationEntry {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

// Simple in-memory conversation history (per user)
const conversationHistory: Map<string, ConversationEntry[]> = new Map();

// Maximum number of entries to keep per user
const MAX_HISTORY_ENTRIES = 20;

function addToHistory(
  userId: string,
  role: 'user' | 'assistant',
  content: string
): void {
  if (!conversationHistory.has(userId)) {
    conversationHistory.set(userId, []);
  }
  const history = conversationHistory.get(userId)!;
  history.push({ role, content, timestamp: Date.now() });

  // Keep only the last N entries
  if (history.length > MAX_HISTORY_ENTRIES) {
    history.splice(0, history.length - MAX_HISTORY_ENTRIES);
  }
}

function getRelevantHistory(userId: string): string {
  const history = conversationHistory.get(userId);
  if (!history || history.length === 0) {
    return 'No relevant prior history.';
  }

  // Build a summary of recent conversation
  const recent = history.slice(-10); // Last 10 entries
  const summary = recent
    .map((entry) => {
      const prefix = entry.role === 'user' ? 'User' : 'Copilot';
      // Truncate long messages
      const content =
        entry.content.length > 150
          ? entry.content.substring(0, 150) + '...'
          : entry.content;
      return `- ${prefix}: ${content}`;
    })
    .join('\n');

  return summary;
}

// ============================================================================
// TOOLS DEFINITIONS - What Claude can do
// ============================================================================

const TOOLS: Anthropic.Tool[] = [
  {
    name: 'create_transaction',
    description:
      'Records a transaction (expense or income). Use this tool when the user mentions spending money, buying something, receiving a payment, getting a deposit, etc.',
    input_schema: {
      type: 'object' as const,
      properties: {
        amount: {
          type: 'number',
          description: 'Amount in dollars (e.g.: 150.50)',
        },
        description: {
          type: 'string',
          description: 'Transaction description (e.g.: "Coffee at Starbucks")',
        },
        type: {
          type: 'string',
          enum: ['expense', 'income'],
          description: 'Transaction type: expense or income',
        },
        category: {
          type: 'string',
          description:
            'Suggested category (e.g.: "Coffee", "Restaurants", "Groceries", "Salary")',
        },
        date: {
          type: 'string',
          description:
            'Date in YYYY-MM-DD format. If the user says "yesterday", calculate the date. Default is today.',
        },
      },
      required: ['amount', 'description', 'type'],
    },
  },
  {
    name: 'create_debt',
    description:
      'Records a debt. Use when the user mentions owing money, having a credit card balance, a loan, etc.',
    input_schema: {
      type: 'object' as const,
      properties: {
        name: {
          type: 'string',
          description: 'Name of the debt (e.g.: "Chase Visa", "Personal loan")',
        },
        amount: {
          type: 'number',
          description: 'Total debt amount in dollars',
        },
        apr: {
          type: 'number',
          description:
            'Annual interest rate (APR) as a percentage (e.g.: 45 for 45%)',
        },
        type: {
          type: 'string',
          enum: [
            'credit_card',
            'personal_loan',
            'auto_loan',
            'mortgage',
            'student_loan',
            'medical',
            'other',
          ],
          description: 'Debt type',
        },
        minimum_payment: {
          type: 'number',
          description: 'Monthly minimum payment (optional)',
        },
      },
      required: ['name', 'amount', 'type'],
    },
  },
  {
    name: 'update_profile',
    description:
      "Updates the user's financial profile (salary, pay frequency, etc). Use when they mention their salary or how they get paid.",
    input_schema: {
      type: 'object' as const,
      properties: {
        monthly_salary: {
          type: 'number',
          description:
            'Monthly salary in dollars. If they say biweekly, multiply by 2.',
        },
        pay_frequency: {
          type: 'string',
          enum: ['weekly', 'biweekly', 'semimonthly', 'monthly'],
          description:
            'Pay frequency: weekly, biweekly (every 2 weeks), semimonthly (twice a month), monthly',
        },
      },
      required: ['monthly_salary'],
    },
  },
  {
    name: 'get_financial_summary',
    description:
      "Gets the user's financial summary. Use when they ask how much they've spent, their balance, their debts, etc.",
    input_schema: {
      type: 'object' as const,
      properties: {
        include_debts: {
          type: 'boolean',
          description: 'Include debt information',
        },
        include_recent_transactions: {
          type: 'boolean',
          description: 'Include recent transactions',
        },
      },
      required: [],
    },
  },
  {
    name: 'create_scheduled_bill',
    description:
      'Schedules a recurring/fixed expense (electricity, water, rent, Netflix, etc). Use when they mention fixed monthly payments.',
    input_schema: {
      type: 'object' as const,
      properties: {
        name: {
          type: 'string',
          description:
            'Name of the expense (e.g.: "Electricity", "Rent", "Netflix")',
        },
        amount: {
          type: 'number',
          description: 'Amount in dollars',
        },
        due_day: {
          type: 'number',
          description: 'Day of the month it is due (1-31)',
        },
        type: {
          type: 'string',
          enum: [
            'mortgage',
            'rent',
            'auto_loan',
            'credit_card',
            'personal_loan',
            'student_loan',
            'utility',
            'insurance',
            'subscription',
            'other',
          ],
          description: 'Type of fixed expense',
        },
      },
      required: ['name', 'amount', 'due_day', 'type'],
    },
  },
  {
    name: 'get_debt_strategy',
    description:
      'Generates a debt payoff plan. Use when they ask how to pay off debts, strategies, avalanche or snowball method.',
    input_schema: {
      type: 'object' as const,
      properties: {
        method: {
          type: 'string',
          enum: ['avalanche', 'snowball', 'both'],
          description:
            'Method: avalanche (highest interest first), snowball (lowest balance first), both (show both)',
        },
      },
      required: [],
    },
  },
];

// ============================================================================
// TOOL EXECUTORS - What happens when Claude calls a tool
// ============================================================================

async function executeCreateTransaction(
  userId: string,
  params: {
    amount: number;
    description: string;
    type: 'expense' | 'income';
    category?: string;
    date?: string;
  }
): Promise<{
  transactionId: string;
  categoryId: string | null;
  categoryName: string | null;
}> {
  const db = getDb();
  const amountCents = Math.round(params.amount * 100);

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
      name: 'Cash',
      type: 'cash',
      createdAt: Date.now(),
    });
    const [newAccount] = await db
      .select()
      .from(accounts)
      .where(eq(accounts.id, id));
    defaultAccount = newAccount!;
  }

  // Find or create category
  let categoryId: string | null = null;
  let categoryName: string | null = params.category || null;

  if (params.category) {
    const userCategories = await db
      .select()
      .from(categories)
      .where(eq(categories.userId, userId));

    const existing = userCategories.find(
      (c) => c.name.toLowerCase() === params.category!.toLowerCase()
    );

    if (existing) {
      categoryId = existing.id;
      categoryName = existing.name;
    } else {
      // Auto-create the category
      const newId = nanoid();
      const emoji = getCategoryEmoji(params.category);
      await db.insert(categories).values({
        id: newId,
        userId,
        name: params.category,
        emoji,
        createdAt: Date.now(),
      });
      categoryId = newId;
    }
  }

  // Create transaction
  const transactionId = nanoid();
  const now = Date.now();
  const date = params.date || new Date().toISOString().split('T')[0]!;

  await db.insert(transactions).values({
    id: transactionId,
    userId,
    date,
    description: params.description,
    amountCents:
      params.type === 'expense'
        ? -Math.abs(amountCents)
        : Math.abs(amountCents),
    type: params.type,
    categoryId,
    accountId: defaultAccount.id,
    cleared: false,
    notes: null,
    createdAt: now,
    updatedAt: now,
  });

  return { transactionId, categoryId, categoryName };
}

async function executeCreateDebt(
  userId: string,
  params: {
    name: string;
    amount: number;
    apr?: number;
    type: string;
    minimum_payment?: number;
  }
): Promise<{ debtId: string }> {
  const db = getDb();
  const amountCents = Math.round(params.amount * 100);

  // Calculate danger score
  let dangerScore = 0;
  if (params.apr) {
    if (params.apr >= 25) dangerScore += 40;
    else if (params.apr >= 18) dangerScore += 30;
    else if (params.apr >= 12) dangerScore += 20;
  }
  if (params.amount >= 50000) dangerScore += 40;
  else if (params.amount >= 20000) dangerScore += 30;
  else if (params.amount >= 10000) dangerScore += 20;

  const id = nanoid();
  const now = Date.now();

  await db.insert(debts).values({
    id,
    userId,
    name: params.name,
    type: params.type as any,
    originalBalanceCents: amountCents,
    currentBalanceCents: amountCents,
    aprPercent: params.apr ?? 0,
    minimumPaymentCents: params.minimum_payment
      ? Math.round(params.minimum_payment * 100)
      : null,
    status: 'active',
    dangerScore: Math.min(100, dangerScore),
    createdAt: now,
    updatedAt: now,
  });

  return { debtId: id };
}

async function executeUpdateProfile(
  userId: string,
  params: {
    monthly_salary: number;
    pay_frequency?: string;
  }
): Promise<{ success: boolean }> {
  const db = getDb();
  const now = Date.now();
  const salaryCents = Math.round(params.monthly_salary * 100);

  const [existing] = await db
    .select()
    .from(userProfiles)
    .where(eq(userProfiles.userId, userId));

  if (existing) {
    await db
      .update(userProfiles)
      .set({
        monthlySalaryCents: salaryCents,
        payFrequency: (params.pay_frequency as any) ?? existing.payFrequency,
        updatedAt: now,
      })
      .where(eq(userProfiles.userId, userId));
  } else {
    await db.insert(userProfiles).values({
      id: nanoid(),
      userId,
      monthlySalaryCents: salaryCents,
      payFrequency: (params.pay_frequency as any) || 'monthly',
      onboardingCompleted: false,
      onboardingStep: 1,
      createdAt: now,
      updatedAt: now,
    });
  }

  return { success: true };
}

async function executeGetFinancialSummary(
  userId: string,
  params: {
    include_debts?: boolean;
    include_recent_transactions?: boolean;
  }
): Promise<{
  monthlyIncome: number;
  monthlyExpenses: number;
  balance: number;
  transactionCount: number;
  debts?: Array<{ name: string; balance: number; apr: number; type: string }>;
  recentTransactions?: Array<{
    description: string;
    amount: number;
    type: string;
    date: string;
  }>;
}> {
  const db = getDb();

  // Get this month's transactions
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .split('T')[0]!;

  const monthTx = await db
    .select({
      amountCents: transactions.amountCents,
      type: transactions.type,
      description: transactions.description,
      date: transactions.date,
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

  const result: any = {
    monthlyIncome: totalIncome / 100,
    monthlyExpenses: totalExpenses / 100,
    balance: (totalIncome - totalExpenses) / 100,
    transactionCount: monthTx.length,
  };

  if (params.include_debts) {
    const userDebts = await db
      .select({
        name: debts.name,
        currentBalanceCents: debts.currentBalanceCents,
        aprPercent: debts.aprPercent,
        type: debts.type,
      })
      .from(debts)
      .where(and(eq(debts.userId, userId), eq(debts.status, 'active')));

    result.debts = userDebts.map((d) => ({
      name: d.name,
      balance: d.currentBalanceCents / 100,
      apr: d.aprPercent,
      type: d.type,
    }));
  }

  if (params.include_recent_transactions) {
    const recent = await db
      .select({
        description: transactions.description,
        amountCents: transactions.amountCents,
        type: transactions.type,
        date: transactions.date,
      })
      .from(transactions)
      .where(eq(transactions.userId, userId))
      .orderBy(desc(transactions.createdAt))
      .limit(5);

    result.recentTransactions = recent.map((t) => ({
      description: t.description,
      amount: Math.abs(t.amountCents) / 100,
      type: t.type,
      date: t.date,
    }));
  }

  return result;
}

async function executeCreateScheduledBill(
  userId: string,
  params: {
    name: string;
    amount: number;
    due_day: number;
    type: string;
  }
): Promise<{ billId: string }> {
  const db = getDb();
  const amountCents = Math.round(params.amount * 100);

  const id = nanoid();
  const now = Date.now();

  // Calculate next due date
  const today = new Date();
  const nextDueDate = new Date(
    today.getFullYear(),
    today.getMonth(),
    params.due_day
  );
  if (nextDueDate <= today) {
    nextDueDate.setMonth(nextDueDate.getMonth() + 1);
  }

  await db.insert(scheduledBills).values({
    id,
    userId,
    name: params.name,
    type: params.type as any,
    amountCents,
    dueDay: params.due_day,
    frequency: 'monthly',
    status: 'active',
    nextDueDate: nextDueDate.toISOString().split('T')[0],
    createdAt: now,
    updatedAt: now,
  });

  return { billId: id };
}

async function executeGetDebtStrategy(
  userId: string,
  _params: { method?: string }
): Promise<{
  totalDebt: number;
  debts: Array<{ name: string; balance: number; apr: number }>;
  avalancheOrder: string[];
  snowballOrder: string[];
  recommendation: string;
}> {
  const db = getDb();

  const userDebts = await db
    .select({
      name: debts.name,
      currentBalanceCents: debts.currentBalanceCents,
      aprPercent: debts.aprPercent,
    })
    .from(debts)
    .where(and(eq(debts.userId, userId), eq(debts.status, 'active')));

  if (userDebts.length === 0) {
    return {
      totalDebt: 0,
      debts: [],
      avalancheOrder: [],
      snowballOrder: [],
      recommendation: "You have no debts recorded. That's great!",
    };
  }

  const debtsList = userDebts.map((d) => ({
    name: d.name,
    balance: d.currentBalanceCents / 100,
    apr: d.aprPercent,
  }));

  const totalDebt = debtsList.reduce((sum, d) => sum + d.balance, 0);

  // Avalanche: highest APR first
  const avalanche = [...debtsList].sort((a, b) => b.apr - a.apr);
  // Snowball: lowest balance first
  const snowball = [...debtsList].sort((a, b) => a.balance - b.balance);

  const hasHighInterest = debtsList.some((d) => d.apr >= 25);
  const recommendation = hasHighInterest
    ? 'With high-interest debts, the Avalanche method will save you the most money long-term.'
    : 'Both methods work well. Snowball will give you quick wins that keep you motivated.';

  return {
    totalDebt,
    debts: debtsList,
    avalancheOrder: avalanche.map((d) => d.name),
    snowballOrder: snowball.map((d) => d.name),
    recommendation,
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getCategoryEmoji(category: string): string {
  const emojiMap: Record<string, string> = {
    café: '☕',
    coffee: '☕',
    restaurantes: '🍽️',
    restaurant: '🍽️',
    comida: '🍽️',
    food: '🍽️',
    supermercado: '🛒',
    super: '🛒',
    groceries: '🛒',
    uber: '🚕',
    didi: '🚕',
    taxi: '🚕',
    transporte: '🚗',
    gasolina: '⛽',
    gas: '⛽',
    luz: '💡',
    agua: '💧',
    internet: '🌐',
    celular: '📱',
    ropa: '👕',
    clothes: '👕',
    netflix: '📺',
    streaming: '📺',
    cine: '🎬',
    gym: '💪',
    gimnasio: '💪',
    doctor: '🏥',
    salud: '🏥',
    farmacia: '💊',
    renta: '🏠',
    rent: '🏠',
    salario: '💰',
    salary: '💰',
    freelance: '💻',
    bono: '🎯',
    regalo: '🎁',
    mascota: '🐾',
    pet: '🐾',
    educación: '📚',
    education: '📚',
    viaje: '✈️',
    travel: '✈️',
    hotel: '🏨',
    bar: '🍺',
    videojuegos: '🎮',
    gaming: '🎮',
  };

  const lower = category.toLowerCase();
  for (const [key, emoji] of Object.entries(emojiMap)) {
    if (lower.includes(key)) return emoji;
  }
  return '📦';
}

// ============================================================================
// STATE BUILDER - Creates comprehensive user state for context
// ============================================================================

interface UserState {
  income: Array<{
    amount: number;
    description: string;
    frequency?: string;
    next_date?: string;
  }>;
  current_month_expenses: {
    total: number;
    by_category: Array<{ category: string; amount: number }>;
    recent_transactions: Array<{
      description: string;
      amount: number;
      category?: string;
      date: string;
    }>;
  };
  debts: Array<{
    name: string;
    type: string;
    outstanding_balance: number;
    annual_rate: number;
    minimum_payment?: number;
    due_date?: string;
    status: string;
  }>;
  scheduled_payments: Array<{
    name: string;
    amount: number;
    date: string;
    frequency: string;
    type: string;
  }>;
  profile: {
    monthly_salary?: number;
    pay_frequency?: string;
  };
  summary: {
    monthly_income: number;
    monthly_expenses: number;
    available_balance: number;
    total_debts: number;
    today_date: string;
  };
  alerts: string[];
}

async function buildUserState(userId: string): Promise<UserState> {
  const db = getDb();
  const now = new Date();
  const today = now.toISOString().split('T')[0]!;
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .split('T')[0]!;

  // Get user profile
  const [profile] = await db
    .select()
    .from(userProfiles)
    .where(eq(userProfiles.userId, userId));

  // Get this month's transactions
  const monthTx = await db
    .select({
      amountCents: transactions.amountCents,
      type: transactions.type,
      description: transactions.description,
      date: transactions.date,
      categoryId: transactions.categoryId,
    })
    .from(transactions)
    .where(
      and(eq(transactions.userId, userId), gte(transactions.date, startOfMonth))
    )
    .orderBy(desc(transactions.createdAt));

  // Get categories for mapping
  const userCategories = await db
    .select()
    .from(categories)
    .where(eq(categories.userId, userId));

  const categoryMap = new Map(userCategories.map((c) => [c.id, c.name]));

  // Calculate totals
  const totalIncome = monthTx
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + Math.abs(t.amountCents), 0);
  const totalExpenses = monthTx
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + Math.abs(t.amountCents), 0);

  // Group expenses by category
  const expensesByCategory = new Map<string, number>();
  monthTx
    .filter((t) => t.type === 'expense')
    .forEach((t) => {
      const catName = t.categoryId
        ? categoryMap.get(t.categoryId) || 'Uncategorized'
        : 'Uncategorized';
      expensesByCategory.set(
        catName,
        (expensesByCategory.get(catName) || 0) + Math.abs(t.amountCents)
      );
    });

  // Get debts
  const userDebts = await db
    .select()
    .from(debts)
    .where(and(eq(debts.userId, userId), eq(debts.status, 'active')));

  // Get scheduled bills
  const bills = await db
    .select()
    .from(scheduledBills)
    .where(
      and(
        eq(scheduledBills.userId, userId),
        eq(scheduledBills.status, 'active')
      )
    );

  // Build alerts
  const alerts: string[] = [];

  // Check for upcoming payments (within 5 days)
  const fiveDaysFromNow = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000);
  bills.forEach((bill) => {
    if (bill.nextDueDate) {
      const dueDate = new Date(bill.nextDueDate);
      if (dueDate <= fiveDaysFromNow && dueDate >= now) {
        alerts.push(
          `UPCOMING_PAYMENT: ${bill.name} is due ${bill.nextDueDate} ($${(bill.amountCents / 100).toFixed(2)})`
        );
      }
    }
  });

  // Check for high APR debts
  userDebts.forEach((debt) => {
    if (debt.aprPercent > 30) {
      alerts.push(
        `HIGH_RATE: ${debt.name} has ${debt.aprPercent}% APR - prioritize`
      );
    }
  });

  // Check for negative projected balance
  const projectedBalance =
    (totalIncome - totalExpenses) / 100 -
    bills.reduce((sum, b) => sum + b.amountCents / 100, 0);
  if (projectedBalance < 0) {
    alerts.push(
      `NEGATIVE_BALANCE: Projected negative balance ($${projectedBalance.toFixed(2)})`
    );
  }

  const totalDebt = userDebts.reduce(
    (sum, d) => sum + d.currentBalanceCents,
    0
  );

  return {
    income: monthTx
      .filter((t) => t.type === 'income')
      .slice(0, 5)
      .map((t) => ({
        amount: Math.abs(t.amountCents) / 100,
        description: t.description,
      })),
    current_month_expenses: {
      total: totalExpenses / 100,
      by_category: Array.from(expensesByCategory.entries()).map(
        ([cat, amount]) => ({
          category: cat,
          amount: amount / 100,
        })
      ),
      recent_transactions: monthTx
        .filter((t) => t.type === 'expense')
        .slice(0, 10)
        .map((t) => ({
          description: t.description,
          amount: Math.abs(t.amountCents) / 100,
          category: t.categoryId
            ? categoryMap.get(t.categoryId) || undefined
            : undefined,
          date: t.date,
        })),
    },
    debts: userDebts.map((d) => ({
      name: d.name,
      type: d.type,
      outstanding_balance: d.currentBalanceCents / 100,
      annual_rate: d.aprPercent,
      minimum_payment: d.minimumPaymentCents
        ? d.minimumPaymentCents / 100
        : undefined,
      status: d.status,
    })),
    scheduled_payments: bills.map((b) => ({
      name: b.name,
      amount: b.amountCents / 100,
      date: b.nextDueDate || `day ${b.dueDay}`,
      frequency: b.frequency,
      type: b.type,
    })),
    profile: {
      monthly_salary: profile?.monthlySalaryCents
        ? profile.monthlySalaryCents / 100
        : undefined,
      pay_frequency: profile?.payFrequency || undefined,
    },
    summary: {
      monthly_income: totalIncome / 100,
      monthly_expenses: totalExpenses / 100,
      available_balance: (totalIncome - totalExpenses) / 100,
      total_debts: totalDebt / 100,
      today_date: today,
    },
    alerts,
  };
}

function buildContextPrompt(
  state: UserState,
  history: string,
  userMessage: string
): string {
  return `[CURRENT_STATE]
${JSON.stringify(state, null, 2)}

[RELEVANT_HISTORY]
${history}

[USER_MESSAGE]
${userMessage}`;
}

// ============================================================================
// MAIN ENTRY POINT
// ============================================================================

export async function processMessage(
  userId: string,
  userMessage: string
): Promise<CopilotResponse> {
  try {
    // Add user message to history
    addToHistory(userId, 'user', userMessage);

    // Build comprehensive user state
    const userState = await buildUserState(userId);
    const relevantHistory = getRelevantHistory(userId);

    // Build the context prompt
    const contextPrompt = buildContextPrompt(
      userState,
      relevantHistory,
      userMessage
    );

    // Call Claude with tools
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1200,
      system: SYSTEM_PROMPT,
      tools: TOOLS,
      messages: [
        {
          role: 'user',
          content: contextPrompt,
        },
      ],
    });

    // Process the response
    let finalMessage = '';
    let transactionCreated = false;
    let transactionId: string | undefined;
    let debtCreated = false;
    let debtId: string | undefined;
    let transaction: ExtractedTransaction | undefined;

    // Handle tool calls
    for (const content of response.content) {
      if (content.type === 'text') {
        finalMessage = content.text;
      } else if (content.type === 'tool_use') {
        const toolName = content.name;
        const toolInput = content.input as any;

        let toolResult: any;

        switch (toolName) {
          case 'create_transaction': {
            const txResult = await executeCreateTransaction(userId, toolInput);
            transactionCreated = true;
            transactionId = txResult.transactionId;
            transaction = {
              amountCents: Math.round(toolInput.amount * 100),
              description: toolInput.description,
              merchant: null,
              date: toolInput.date || new Date().toISOString().split('T')[0]!,
              categoryId: txResult.categoryId,
              categoryName: txResult.categoryName,
              type: toolInput.type,
              notes: null,
            };
            toolResult = {
              success: true,
              transactionId: txResult.transactionId,
            };
            break;
          }

          case 'create_debt': {
            const debtResult = await executeCreateDebt(userId, toolInput);
            debtCreated = true;
            debtId = debtResult.debtId;
            toolResult = { success: true, debtId: debtResult.debtId };
            break;
          }

          case 'update_profile':
            await executeUpdateProfile(userId, toolInput);
            toolResult = { success: true };
            break;

          case 'get_financial_summary':
            toolResult = await executeGetFinancialSummary(userId, toolInput);
            break;

          case 'create_scheduled_bill': {
            const billResult = await executeCreateScheduledBill(
              userId,
              toolInput
            );
            toolResult = { success: true, billId: billResult.billId };
            break;
          }

          case 'get_debt_strategy':
            toolResult = await executeGetDebtStrategy(userId, toolInput);
            break;

          default:
            toolResult = { error: 'Unknown tool' };
        }

        // Get Claude's response after tool use
        const followUp = await anthropic.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1024,
          system: SYSTEM_PROMPT,
          messages: [
            { role: 'user', content: userMessage },
            { role: 'assistant', content: response.content },
            {
              role: 'user',
              content: [
                {
                  type: 'tool_result',
                  tool_use_id: content.id,
                  content: JSON.stringify(toolResult),
                },
              ],
            },
          ],
        });

        // Extract final text response
        for (const followUpContent of followUp.content) {
          if (followUpContent.type === 'text') {
            finalMessage = followUpContent.text;
          }
        }
      }
    }

    // Build follow-up actions based on context
    const followUpActions: CopilotResponse['followUpActions'] = [];

    if (transactionCreated) {
      followUpActions.push(
        { label: 'Another expense', type: 'quick_reply', value: 'I spent $' },
        {
          label: 'View summary',
          type: 'quick_reply',
          value: 'How much have I spent?',
        }
      );
    } else if (debtCreated) {
      followUpActions.push(
        {
          label: 'View debts',
          type: 'quick_reply',
          value: 'How much do I owe?',
        },
        {
          label: 'Payment plan',
          type: 'quick_reply',
          value: 'How do I pay off my debts?',
        }
      );
    } else {
      followUpActions.push(
        {
          label: 'Record expense',
          type: 'quick_reply',
          value: 'I spent $50 on',
        },
        {
          label: 'View summary',
          type: 'quick_reply',
          value: 'How much have I spent?',
        }
      );
    }

    const responseMessage =
      finalMessage ||
      "Hmm, I'm not sure what to do with that. Can you give me more details?";

    // Add assistant response to history
    addToHistory(userId, 'assistant', responseMessage);

    return {
      message: responseMessage,
      transactionCreated,
      transactionId,
      transaction,
      debtCreated,
      debtId,
      followUpActions,
    };
  } catch (error) {
    console.error('Copilot error:', error);

    const errorMessage =
      'Oops! Something went wrong. Try again or tell me what you need in a different way.';

    // Add error response to history too
    addToHistory(userId, 'assistant', errorMessage);

    // Fallback response
    return {
      message: errorMessage,
      followUpActions: [
        { label: 'Record expense', type: 'quick_reply', value: 'I spent $' },
        { label: 'Help', type: 'quick_reply', value: 'What can you do?' },
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

  if (!tx) return false;

  await db
    .update(transactions)
    .set({ categoryId, updatedAt: Date.now() })
    .where(eq(transactions.id, transactionId));

  return true;
}

export function getQuickActions(): Array<{ text: string; example: string }> {
  return [
    { text: 'Record expense', example: 'I spent $30 on lunch' },
    { text: 'Shopping', example: 'I bought clothes for $150 at Zara' },
    { text: 'Transportation', example: '$15 Uber ride' },
    { text: 'Income', example: 'I got paid my $2400 paycheck' },
    { text: 'Set salary', example: 'I earn $5,000 a month' },
    { text: 'Record debt', example: 'I have a credit card with $5000 at 45%' },
    { text: 'Payment plan', example: 'How do I pay off my debts?' },
    { text: 'View summary', example: 'How much have I spent this month?' },
    { text: 'Tips', example: 'What is the 50/30/20 rule?' },
  ];
}

export function clearConversationHistory(userId: string): void {
  conversationHistory.delete(userId);
}
