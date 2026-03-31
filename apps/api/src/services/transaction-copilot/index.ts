/**
 * Transaction Copilot Service
 *
 * Conversational AI agent for adding transactions through natural language.
 * The user describes their spending, and the copilot:
 * 1. Extracts transaction details (amount, description, date)
 * 2. Asks follow-up questions if needed
 * 3. Auto-categorizes based on context
 * 4. Creates the transaction
 */

import { nanoid } from 'nanoid';
import { getDb, saveDatabase } from '../../db/client.js';
import {
  categories,
  transactions,
  accounts,
  userProfiles,
} from '../../db/schema.js';
import { eq, count, and } from 'drizzle-orm';
import type { Message } from '@budget-copilot/ai';
import { getProvider } from '@budget-copilot/ai';
import * as categoryRepo from '../../server/lib/repo/categories.js';
import * as transactionRepo from '../../server/lib/repo/transactions.js';
import * as accountRepo from '../../server/lib/repo/accounts.js';

/**
 * Parse JSON from AI response, handling markdown code blocks and raw text
 * Claude sometimes wraps JSON in ```json ... ``` blocks or responds with plain text
 */
function parseAIResponse(content: string): unknown {
  let jsonStr = content.trim();

  // Remove markdown code blocks if present
  if (jsonStr.startsWith('```')) {
    // Find the end of the opening fence (```json or just ```)
    const firstNewline = jsonStr.indexOf('\n');
    if (firstNewline !== -1) {
      jsonStr = jsonStr.substring(firstNewline + 1);
    }
    // Remove closing fence
    if (jsonStr.endsWith('```')) {
      jsonStr = jsonStr.substring(0, jsonStr.length - 3).trim();
    }
  }

  // Try to parse as JSON
  try {
    return JSON.parse(jsonStr);
  } catch {
    // If parsing fails, Claude responded with raw text instead of JSON
    // Wrap it in the expected format
    console.log('[Copilot] AI returned raw text, wrapping in JSON format');
    return {
      understood: true,
      response: content.trim(),
    };
  }
}

// Onboarding questions flow
const ONBOARDING_QUESTIONS = [
  {
    step: 1,
    question:
      "Hi! I'm your Budget Copilot 🧠 To help you better, how much do you earn per month? (Example: $2500)",
    field: 'monthlySalaryCents',
  },
  {
    step: 2,
    question: 'How often do you get paid? (weekly, biweekly, or monthly)',
    field: 'payFrequency',
  },
  {
    step: 3,
    question:
      'Do you have any debt? (credit cards, loans, etc.) Tell me about the most important one first.',
    field: 'debts',
  },
  {
    step: 4,
    question: 'How much would you like to save each month? (Example: $200)',
    field: 'monthlySavingsGoalCents',
  },
];

// Conversation state stored in memory (per session)
// In production, this would be stored in Redis or the database
export interface ConversationState {
  userId: string;
  messages: Message[];
  pendingTransaction: Partial<ExtractedTransaction> | null;
  status: 'idle' | 'collecting_info' | 'confirming' | 'completed';
  createdAt: number;
  updatedAt: number;
}

export interface ExtractedTransaction {
  amountCents: number;
  description: string;
  merchant: string | null;
  date: string; // YYYY-MM-DD
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
  // Onboarding
  isOnboarding?: boolean;
  onboardingStep?: number;
  // Category confirmation
  needsCategoryConfirmation?: boolean;
  categoryOptions?: Array<{ name: string; emoji: string }>;
  pendingTransaction?: Partial<ExtractedTransaction>;
}

// System prompt for the AI - Sassy, smart, encouraging personality
const SYSTEM_PROMPT = `You are Budget Copilot, a financial assistant with personality! You're like that smart, slightly sassy friend who helps you manage your money.

YOUR PERSONALITY:
- You're friendly but direct - you're not afraid to tell the truth
- You use light humor and witty remarks (without going overboard)
- You celebrate income and savings with genuine enthusiasm
- When someone spends a lot, you give a gentle "reality check"
- You always look for opportunities to remind them to save and invest
- You use phrases like "Hey!", "Oof", "Niceee", "Hmm", "Well well", "Yes!"

YOUR JOB:
1. Extract transactions from natural language messages
2. Answer questions about the user's expenses and income
3. Auto-create creative categories with emojis when needed
4. Give short and useful financial tips
5. Encourage the user to spend less and save more

MESSAGE TYPES:
1. TRANSACTION ENTRY: User describes an expense/income -> extract data
2. ANALYTICAL QUESTION: User asks about their finances -> analyze data I provide
3. GENERAL CONVERSATION: Greeting or chat -> respond naturally

When the user describes an expense or income, extract:
1. Amount (required) - amount in dollars
2. Description (required) - what they bought or where the money came from
3. Merchant/Store (optional) - name of the place
4. Date (optional) - "today" by default
5. Type - "expense" for spending, "income" for earnings
6. Suggested category - be creative with names and emojis!

RESPONSES BY SITUATION:
- Income: Celebrate! "Yes! Payday arrived 💰" or "Niceee, that extra money is welcome!"
- Small expenses: Neutral but track it
- Medium expenses: "Got it! Remember every dollar counts 😉"
- Large expenses: "Oof, that one stung 💸 Was it in the budget?"
- Eating out often: "Another restaurant? 🍕 Have you thought about meal prep?"
- Subscriptions: "Another subscription... do you actually use it?"

Always respond in English, concisely and with your personality.

Respond ONLY with valid JSON in this format:
{
  "understood": true/false,
  "needsMoreInfo": true/false,
  "isAnalyticalQuestion": true/false,
  "followUpQuestion": "question if you need more info",
  "transaction": {
    "amountCents": number in cents (e.g.: $50 = 5000),
    "description": "description",
    "merchant": "store or null",
    "date": "YYYY-MM-DD",
    "type": "expense" or "income",
    "suggestedCategory": "suggested category name",
    "suggestedEmoji": "emoji for the category"
  },
  "response": "message with your personality"
}`;

// Patterns to detect analytical questions about finances
const ANALYTICAL_PATTERNS = [
  // How much have I spent/earned/etc
  /\b(how\s+much)\s+(have\s+i|did\s+i|do\s+i)\s+(spen[dt]|earn|make|have)/i,
  // What am I spending on / have I spent on
  /\b(what)\s+(am\s+i|have\s+i|did\s+i)\s+(spend)/i,
  // Where is my money going
  /\b(where)\s+(is|does|did)\s+(my\s+money|it)\s+(go|going)/i,
  // Spending too much
  /\b(too\s+much|a\s+lot|overspend)\b.*(spend|money)/i,
  // Summary, analysis, report
  /\b(summary|analysis|report|statistics|breakdown)\b/i,
  // How am I doing with my finances
  /\b(how)\s+(am\s+i|are\s+my)\s+(doing|finances|budget)/i,
  // What category do I spend most on
  /\b(what|which)\s+(category|type).*(spend|most)/i,
  // Trends, patterns, averages
  /\b(trend|pattern|average)\b/i,
  // Compare months/weeks
  /\b(compar|difference)\b.*(month|week|year)/i,
  // Can I / should I save
  /\b(can\s+i|should\s+i)\s+(save|spend)/i,
  // More this month/week
  /\b(more)\s+(this)\s+(month|week)/i,
  // Spent more
  /\b(spent|spend)\s+(more|most)/i,
  // Help me with finances
  /\b(help).*(financ|money|budget|spend|sav)/i,
];

// Patterns to detect advice/recommendation questions
const ADVICE_PATTERNS = [
  /\b(what)\s+(do\s+you\s+)?(recommend|suggest|advise)/i,
  /\b(how)\s+(can\s+i|could\s+i|should\s+i|do\s+i)\s+(save|invest|improve|start|begin|create|make)/i,
  /\b(tips?|advice|recommendation)/i,
  /\b(emergency\s+fund|emergencies)/i,
  /\b(save|invest|improve)\s+(more|better|my)/i,
  /\b(strategy|plan)\s+(for\s+)?(saving|financ|budget)/i,
  /\b(should\s+i)\s+(do|start|begin|save|invest)/i,
  /\b(help).*(sav|invest|budget|financ)/i,
  /\bhow\s+to\s+sav/i,
];

// Category mapping with emojis for auto-creation
const CATEGORY_CONFIG: Record<string, { patterns: string[]; emoji: string }> = {
  Shopping: {
    patterns: [
      'clothes',
      'clothing',
      'shoes',
      'nike',
      'zara',
      'h&m',
      'adidas',
      'store',
      'mall',
      'shopping center',
      'amazon',
      'bought',
      'shopping',
    ],
    emoji: '🛍️',
  },
  Groceries: {
    patterns: [
      'grocery',
      'groceries',
      'supermarket',
      'market',
      'walmart',
      'costco',
      'food',
      'vegetables',
      'fruits',
      'pricesmart',
      'trader joe',
      'whole foods',
    ],
    emoji: '🛒',
  },
  Restaurants: {
    patterns: [
      'restaurant',
      'lunch',
      'dinner',
      'breakfast',
      'pizza',
      'sushi',
      'hamburger',
      'mcdonald',
      'burger',
      'kfc',
      'chicken',
      'ate',
      'meal',
    ],
    emoji: '🍽️',
  },
  Coffee: {
    patterns: [
      'coffee',
      'cafe',
      'starbucks',
      'dunkin',
      'coffeehouse',
      'latte',
      'cappuccino',
    ],
    emoji: '☕',
  },
  Transportation: {
    patterns: [
      'uber',
      'taxi',
      'gas',
      'gasoline',
      'parking',
      'metro',
      'bus',
      'transit',
      'lyft',
      'rideshare',
    ],
    emoji: '🚗',
  },
  Entertainment: {
    patterns: [
      'movie',
      'movies',
      'games',
      'concert',
      'film',
      'entertainment',
      'party',
      'bar',
      'club',
      'fun',
    ],
    emoji: '🎬',
  },
  Streaming: {
    patterns: [
      'netflix',
      'spotify',
      'disney',
      'hbo',
      'prime',
      'youtube',
      'apple tv',
      'streaming',
      'max',
    ],
    emoji: '📺',
  },
  Health: {
    patterns: [
      'pharmacy',
      'medicine',
      'doctor',
      'hospital',
      'dentist',
      'medical',
      'health',
      'appointment',
      'medication',
    ],
    emoji: '🏥',
  },
  Utilities: {
    patterns: [
      'electric',
      'water',
      'internet',
      'phone',
      'cable',
      'electricity',
      'utilities',
      'natural gas',
      'bill',
    ],
    emoji: '💡',
  },
  Gym: {
    patterns: [
      'gym',
      'fitness',
      'exercise',
      'workout',
      'yoga',
      'sport',
      'crossfit',
      'training',
    ],
    emoji: '💪',
  },
  Beauty: {
    patterns: [
      'hair salon',
      'salon',
      'nails',
      'barber',
      'spa',
      'beauty',
      'haircut',
      'makeup',
      'skincare',
    ],
    emoji: '💅',
  },
  Education: {
    patterns: [
      'book',
      'course',
      'school',
      'university',
      'class',
      'education',
      'udemy',
      'coursera',
      'study',
      'tuition',
    ],
    emoji: '📚',
  },
  Subscriptions: {
    patterns: ['subscription', 'membership', 'monthly', 'annual', 'premium'],
    emoji: '🔄',
  },
  Gifts: {
    patterns: ['gift', 'birthday', 'christmas', 'present', 'surprise'],
    emoji: '🎁',
  },
  Travel: {
    patterns: [
      'hotel',
      'flight',
      'trip',
      'airbnb',
      'airplane',
      'vacation',
      'lodging',
      'ticket',
      'travel',
    ],
    emoji: '✈️',
  },
  Pets: {
    patterns: ['pet', 'dog', 'cat', 'veterinarian', 'pet food', 'vet'],
    emoji: '🐾',
  },
  Home: {
    patterns: [
      'house',
      'home',
      'furniture',
      'decor',
      'appliance',
      'cleaning',
      'hardware store',
    ],
    emoji: '🏠',
  },
  Technology: {
    patterns: [
      'phone',
      'laptop',
      'computer',
      'tech',
      'gadget',
      'electronics',
      'apple',
      'samsung',
    ],
    emoji: '📱',
  },
  Insurance: {
    patterns: ['insurance', 'policy', 'coverage', 'premium'],
    emoji: '🛡️',
  },
  Salary: {
    patterns: [
      'salary',
      'wages',
      'paycheck',
      'payment',
      'payroll',
      'income',
      'work',
    ],
    emoji: '💰',
  },
  Freelance: {
    patterns: [
      'freelance',
      'project',
      'client',
      'side job',
      'side hustle',
      'consulting',
    ],
    emoji: '💻',
  },
  Investments: {
    patterns: [
      'investment',
      'dividend',
      'interest',
      'return',
      'stocks',
      'crypto',
      'bitcoin',
    ],
    emoji: '📈',
  },
  Debt: {
    patterns: ['debt', 'loan', 'card', 'credit', 'card payment', 'installment'],
    emoji: '💳',
  },
  Savings: {
    patterns: ['savings', 'saved', 'set aside', 'reserve', 'fund', 'emergency'],
    emoji: '🐷',
  },
};

// Legacy patterns mapping for backward compatibility
const CATEGORY_PATTERNS: Record<string, string[]> = Object.fromEntries(
  Object.entries(CATEGORY_CONFIG).map(([name, config]) => [
    name,
    config.patterns,
  ])
);

/**
 * Get or create user profile
 */
async function getOrCreateUserProfile(db: any, userId: string) {
  const existing = await db
    .select()
    .from(userProfiles)
    .where(eq(userProfiles.userId, userId));

  if (existing.length > 0) {
    return existing[0];
  }

  // Create new profile
  const id = nanoid();
  await db.insert(userProfiles).values({
    id,
    userId,
    onboardingCompleted: false,
    onboardingStep: 0,
  });
  saveDatabase();

  return (
    await db.select().from(userProfiles).where(eq(userProfiles.id, id))
  )[0];
}

/**
 * Check if user needs onboarding
 */
async function needsOnboarding(
  db: any,
  userId: string
): Promise<{ needs: boolean; step: number }> {
  const profile = await getOrCreateUserProfile(db, userId);

  if (profile.onboardingCompleted) {
    return { needs: false, step: 0 };
  }

  // Check if user has any transactions (skip onboarding if already using)
  const txCount = await db
    .select({ count: count() })
    .from(transactions)
    .where(eq(transactions.userId, userId));

  if (txCount[0]?.count > 3) {
    // User has transactions, mark onboarding as completed
    await db
      .update(userProfiles)
      .set({ onboardingCompleted: true })
      .where(eq(userProfiles.userId, userId));
    saveDatabase();
    return { needs: false, step: 0 };
  }

  return { needs: true, step: profile.onboardingStep };
}

/**
 * Process onboarding response and update profile
 */
async function processOnboardingResponse(
  db: any,
  userId: string,
  userMessage: string,
  currentStep: number
): Promise<CopilotResponse> {
  const _profile = await getOrCreateUserProfile(db, userId);
  const lowerMessage = userMessage.toLowerCase();

  // Process based on current step
  switch (currentStep) {
    case 0:
      // Initial greeting - just start asking questions
      await db
        .update(userProfiles)
        .set({ onboardingStep: 1 })
        .where(eq(userProfiles.userId, userId));
      saveDatabase();
      return {
        message: ONBOARDING_QUESTIONS[0].question,
        isOnboarding: true,
        onboardingStep: 1,
      };

    case 1: {
      // Salary
      const salaryMatch = userMessage.match(/\$?\s*([\d,]+(?:\.\d{2})?)/);
      if (salaryMatch) {
        const salaryCents = parseMoneyToCents(salaryMatch[1]);
        await db
          .update(userProfiles)
          .set({
            monthlySalaryCents: salaryCents,
            onboardingStep: 2,
            updatedAt: Date.now(),
          })
          .where(eq(userProfiles.userId, userId));
        saveDatabase();

        const formattedSalary = (salaryCents / 100).toFixed(2);
        return {
          message: `Perfect! $${formattedSalary} per month. ${ONBOARDING_QUESTIONS[1].question}`,
          isOnboarding: true,
          onboardingStep: 2,
        };
      }
      return {
        message:
          "I didn't understand the amount. How much do you earn per month? (Example: $2500)",
        isOnboarding: true,
        onboardingStep: 1,
      };
    }

    case 2: {
      // Pay frequency
      let frequency: string | null = null;
      if (lowerMessage.includes('weekly') || lowerMessage.includes('week')) {
        frequency = 'weekly';
      } else if (
        lowerMessage.includes('biweekly') ||
        lowerMessage.includes('bi-weekly') ||
        lowerMessage.includes('every two weeks')
      ) {
        frequency = 'biweekly';
      } else if (
        lowerMessage.includes('monthly') ||
        lowerMessage.includes('month')
      ) {
        frequency = 'monthly';
      }

      if (frequency) {
        await db
          .update(userProfiles)
          .set({
            payFrequency: frequency,
            onboardingStep: 3,
            updatedAt: Date.now(),
          })
          .where(eq(userProfiles.userId, userId));
        saveDatabase();

        const freqText =
          frequency === 'weekly'
            ? 'weekly'
            : frequency === 'biweekly'
              ? 'biweekly'
              : 'monthly';
        return {
          message: `Got it, you get paid ${freqText}. ${ONBOARDING_QUESTIONS[2].question}`,
          isOnboarding: true,
          onboardingStep: 3,
        };
      }
      return {
        message: 'Weekly, biweekly, or monthly?',
        isOnboarding: true,
        onboardingStep: 2,
      };
    }

    case 3: // Debts
      if (
        lowerMessage.includes('no') ||
        lowerMessage.includes('none') ||
        lowerMessage.includes('nothing')
      ) {
        await db
          .update(userProfiles)
          .set({ onboardingStep: 4, updatedAt: Date.now() })
          .where(eq(userProfiles.userId, userId));
        saveDatabase();
        return {
          message: `Excellent! No debt is a great start 🎉 ${ONBOARDING_QUESTIONS[3].question}`,
          isOnboarding: true,
          onboardingStep: 4,
        };
      }
      // TODO: Parse debt info and create debt record
      await db
        .update(userProfiles)
        .set({ onboardingStep: 4, updatedAt: Date.now() })
        .where(eq(userProfiles.userId, userId));
      saveDatabase();
      return {
        message: `Got it, I noted that. You can add more debts later in the Debts section. ${ONBOARDING_QUESTIONS[3].question}`,
        isOnboarding: true,
        onboardingStep: 4,
      };

    case 4: {
      // Savings goal
      const savingsMatch = userMessage.match(/\$?\s*([\d,]+(?:\.\d{2})?)/);
      if (savingsMatch) {
        const savingsCents = parseMoneyToCents(savingsMatch[1]);
        await db
          .update(userProfiles)
          .set({
            monthlySavingsGoalCents: savingsCents,
            onboardingStep: 5,
            onboardingCompleted: true,
            updatedAt: Date.now(),
          })
          .where(eq(userProfiles.userId, userId));
        saveDatabase();

        const formattedSavings = (savingsCents / 100).toFixed(2);
        return {
          message: `Great! Savings goal: $${formattedSavings}/month 🐷\n\nYou're all set! Now you can tell me about your expenses and income. For example: "Spent $30 on lunch" or "Got my paycheck of $1500"`,
          isOnboarding: false,
          onboardingStep: 5,
        };
      }
      // Skip savings if they say no/skip
      if (
        lowerMessage.includes('no') ||
        lowerMessage.includes('skip') ||
        lowerMessage.includes('skip')
      ) {
        await db
          .update(userProfiles)
          .set({
            onboardingStep: 5,
            onboardingCompleted: true,
            updatedAt: Date.now(),
          })
          .where(eq(userProfiles.userId, userId));
        saveDatabase();
        return {
          message:
            'Done! You can set your savings goal later.\n\nNow tell me: what did you spend today? 💸',
          isOnboarding: false,
          onboardingStep: 5,
        };
      }
      return {
        message:
          'How much would you like to save each month? (Example: $200, or type "skip" to skip)',
        isOnboarding: true,
        onboardingStep: 4,
      };
    }

    default:
      return {
        message: 'Ready to help! What did you spend today?',
        isOnboarding: false,
      };
  }
}

/**
 * Find matching categories for a text
 */
function findMatchingCategories(
  text: string
): Array<{ name: string; emoji: string; confidence: number }> {
  const lowerText = text.toLowerCase();
  const matches: Array<{ name: string; emoji: string; confidence: number }> =
    [];

  for (const [categoryName, config] of Object.entries(CATEGORY_CONFIG)) {
    let matchCount = 0;
    for (const pattern of config.patterns) {
      if (lowerText.includes(pattern)) {
        matchCount++;
      }
    }
    if (matchCount > 0) {
      matches.push({
        name: categoryName,
        emoji: config.emoji,
        confidence: matchCount / config.patterns.length,
      });
    }
  }

  // Sort by confidence descending
  return matches.sort((a, b) => b.confidence - a.confidence);
}

/**
 * Check if message is an analytical question
 */
function isAnalyticalQuestion(text: string): boolean {
  return ANALYTICAL_PATTERNS.some((pattern) => pattern.test(text));
}

/**
 * Check if message is an advice/recommendation question
 */
function isAdviceQuestion(text: string): boolean {
  return ADVICE_PATTERNS.some((pattern) => pattern.test(text));
}

/**
 * Get spending summary for a user (last 30 days by default)
 */
async function getSpendingSummary(
  db: any,
  userId: string,
  daysBack: number = 30
): Promise<{
  totalExpenses: number;
  totalIncome: number;
  byCategory: Array<{
    name: string;
    emoji: string | null;
    total: number;
    count: number;
  }>;
  recentTransactions: Array<{
    description: string;
    amount: number;
    date: string;
    category: string | null;
  }>;
}> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - daysBack);
  const startDateStr = startDate.toISOString().split('T')[0];

  // Get all transactions for the period
  const userTxs = await db
    .select()
    .from(transactions)
    .where(eq(transactions.userId, userId));

  // Filter by date
  const recentTxs = userTxs.filter((tx: any) => tx.date >= startDateStr);

  // Calculate totals
  let totalExpenses = 0;
  let totalIncome = 0;
  const categoryTotals: Record<
    string,
    { name: string; emoji: string | null; total: number; count: number }
  > = {};

  // Get user categories for lookup
  const userCats = await db
    .select()
    .from(categories)
    .where(eq(categories.userId, userId));
  const catMap = new Map<
    string,
    { id: string; name: string; emoji: string | null }
  >(
    userCats.map((c: (typeof userCats)[number]) => [
      c.id,
      { id: c.id, name: c.name, emoji: c.emoji ?? null },
    ])
  );

  for (const tx of recentTxs) {
    const amount = tx.amountCents / 100;
    if (tx.type === 'income' || tx.amountCents > 0) {
      totalIncome += Math.abs(amount);
    } else {
      totalExpenses += Math.abs(amount);
      // Track by category
      const cat = tx.categoryId ? catMap.get(tx.categoryId) : null;
      const catKey = cat?.name || 'Uncategorized';
      if (!categoryTotals[catKey]) {
        categoryTotals[catKey] = {
          name: catKey,
          emoji: cat?.emoji || null,
          total: 0,
          count: 0,
        };
      }
      categoryTotals[catKey].total += Math.abs(amount);
      categoryTotals[catKey].count += 1;
    }
  }

  // Sort categories by total (descending)
  const byCategory = Object.values(categoryTotals).sort(
    (a, b) => b.total - a.total
  );

  // Get last 10 transactions
  const recentTransactions = recentTxs
    .sort(
      (a: any, b: any) =>
        new Date(b.date).getTime() - new Date(a.date).getTime()
    )
    .slice(0, 10)
    .map((tx: any) => {
      const cat = tx.categoryId ? catMap.get(tx.categoryId) : null;
      return {
        description: tx.description,
        amount: tx.amountCents / 100,
        date: tx.date,
        category: cat?.name || null,
      };
    });

  return { totalExpenses, totalIncome, byCategory, recentTransactions };
}

/**
 * Detect subscription-like recurring expenses from actual transaction history.
 * Looks for repeated expenses to same merchants with similar amounts.
 */
async function detectRecurringExpenses(
  db: any,
  userId: string
): Promise<
  Array<{
    name: string;
    amount: number;
    count: number;
    monthlyEstimate: number;
  }>
> {
  // Get last 90 days of transactions to detect patterns
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 90);
  const startDateStr = startDate.toISOString().split('T')[0];

  const userTxs = await db
    .select()
    .from(transactions)
    .where(eq(transactions.userId, userId));

  // Filter to expenses in the date range
  const expenses = userTxs.filter(
    (tx: any) => tx.date >= startDateStr && tx.type === 'expense'
  );

  // Group by description (normalized) to find recurring patterns
  const byDescription: Record<
    string,
    { amounts: number[]; dates: string[]; description: string }
  > = {};

  for (const tx of expenses) {
    // Normalize description for grouping
    const normalizedDesc = tx.description
      .toLowerCase()
      .replace(/[0-9]/g, '')
      .trim();

    if (!byDescription[normalizedDesc]) {
      byDescription[normalizedDesc] = {
        amounts: [],
        dates: [],
        description: tx.description,
      };
    }
    byDescription[normalizedDesc].amounts.push(Math.abs(tx.amountCents));
    byDescription[normalizedDesc].dates.push(tx.date);
  }

  // Find recurring patterns (same merchant, 2+ times, similar amounts)
  const recurring: Array<{
    name: string;
    amount: number;
    count: number;
    monthlyEstimate: number;
  }> = [];

  for (const [, data] of Object.entries(byDescription)) {
    if (data.amounts.length >= 2) {
      // Check if amounts are similar (within 10% variance)
      const avgAmount =
        data.amounts.reduce((a, b) => a + b, 0) / data.amounts.length;
      const allSimilar = data.amounts.every(
        (amt) => Math.abs(amt - avgAmount) / avgAmount < 0.1
      );

      if (allSimilar) {
        // Estimate monthly cost based on frequency
        const daySpan =
          (new Date(data.dates[data.dates.length - 1]!).getTime() -
            new Date(data.dates[0]!).getTime()) /
          (1000 * 60 * 60 * 24);
        const frequency =
          daySpan > 0 ? data.amounts.length / (daySpan / 30) : 1;
        const monthlyEstimate = (avgAmount / 100) * Math.max(1, frequency);

        recurring.push({
          name: data.description,
          amount: avgAmount / 100,
          count: data.amounts.length,
          monthlyEstimate,
        });
      }
    }
  }

  // Sort by monthly estimate descending
  return recurring.sort((a, b) => b.monthlyEstimate - a.monthlyEstimate);
}

/**
 * Get top individual expenses by category with transaction details
 */
async function getTopExpensesByCategory(
  db: any,
  userId: string,
  daysBack: number = 30
): Promise<
  Record<string, Array<{ description: string; amount: number; date: string }>>
> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - daysBack);
  const startDateStr = startDate.toISOString().split('T')[0];

  const userTxs = await db
    .select()
    .from(transactions)
    .where(eq(transactions.userId, userId));

  const userCats = await db
    .select()
    .from(categories)
    .where(eq(categories.userId, userId));
  const catMap = new Map<
    string,
    { id: string; name: string; emoji: string | null }
  >(
    userCats.map((c: (typeof userCats)[number]) => [
      c.id,
      { id: c.id, name: c.name, emoji: c.emoji ?? null },
    ])
  );

  // Filter and group expenses by category
  const byCategory: Record<
    string,
    Array<{ description: string; amount: number; date: string }>
  > = {};

  for (const tx of userTxs) {
    if (tx.date >= startDateStr && tx.type === 'expense') {
      const cat = tx.categoryId ? catMap.get(tx.categoryId) : null;
      const catName = cat?.name || 'Uncategorized';

      if (!byCategory[catName]) {
        byCategory[catName] = [];
      }
      byCategory[catName].push({
        description: tx.description,
        amount: Math.abs(tx.amountCents) / 100,
        date: tx.date,
      });
    }
  }

  // Sort each category by amount descending and keep top 5
  for (const catName of Object.keys(byCategory)) {
    byCategory[catName] = byCategory[catName]
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);
  }

  return byCategory;
}

/**
 * Generate analytical response based on user data
 */
async function processAnalyticalQuestion(
  db: any,
  userId: string,
  userMessage: string,
  conversationHistory: Message[]
): Promise<CopilotResponse> {
  // Get spending summary, recurring expenses, and top expenses by category
  const summary = await getSpendingSummary(db, userId);
  const recurringExpenses = await detectRecurringExpenses(db, userId);
  const topExpensesByCategory = await getTopExpensesByCategory(db, userId);
  const totalRecurringCost = recurringExpenses
    .slice(0, 10)
    .reduce((sum, r) => sum + r.monthlyEstimate, 0);

  // Build recurring expenses section (subscription-like patterns from actual transactions)
  const recurringSection =
    recurringExpenses.length > 0
      ? `\nRECURRING EXPENSES DETECTED (${recurringExpenses.length} patterns, ~$${totalRecurringCost.toFixed(2)}/month estimated):
${recurringExpenses
  .slice(0, 10)
  .map(
    (r, i) =>
      `${i + 1}. ${r.name}: $${r.amount.toFixed(2)} x ${r.count} times (~$${r.monthlyEstimate.toFixed(2)}/month)`
  )
  .join('\n')}`
      : '\nRECURRING EXPENSES: No subscription patterns detected';

  // Build top expenses per category section
  const topExpensesSection = Object.entries(topExpensesByCategory)
    .slice(0, 5)
    .map(([catName, expenses]) => {
      const topExpense = expenses[0];
      return topExpense
        ? `${catName}: Top expense "$${topExpense.description}" $${topExpense.amount.toFixed(2)}`
        : null;
    })
    .filter(Boolean)
    .join('\n');

  const dataContext = `
USER DATA (last 30 days):
- Total spent: $${summary.totalExpenses.toFixed(2)}
- Total income: $${summary.totalIncome.toFixed(2)}
- Balance: $${(summary.totalIncome - summary.totalExpenses).toFixed(2)}

EXPENSES BY CATEGORY (sorted highest to lowest):
${summary.byCategory
  .slice(0, 10)
  .map(
    (c, i) =>
      `${i + 1}. ${c.emoji || ''} ${c.name}: $${c.total.toFixed(2)} (${c.count} transactions)`
  )
  .join('\n')}

TOP EXPENSES BY CATEGORY:
${topExpensesSection}
${recurringSection}

RECENT TRANSACTIONS:
${summary.recentTransactions
  .slice(0, 5)
  .map(
    (t) =>
      `- ${t.date}: ${t.description} $${t.amount.toFixed(2)}${t.category ? ` (${t.category})` : ''}`
  )
  .join('\n')}
`;

  const analyticalPrompt = `${SYSTEM_PROMPT}

${dataContext}

The user is asking a question about their finances. Use the data above to respond in a helpful, specific way with your personality.

Respond with JSON:
{
  "understood": true,
  "isAnalyticalQuestion": true,
  "response": "your analytical response with specific data"
}`;

  // Try AI first
  try {
    const provider = getProvider();
    console.log(
      `[Copilot] AI provider: ${provider.name}, configured: ${provider.isConfigured()}`
    );
    if (provider.isConfigured()) {
      const messages: Message[] = [
        { role: 'system', content: analyticalPrompt },
        ...conversationHistory,
        { role: 'user', content: userMessage },
      ];
      console.log('[Copilot] Calling AI for analytical question...');
      const result = await provider.chat(messages, {
        temperature: 0.5,
        maxTokens: 800,
      });
      console.log('[Copilot] AI response received');
      const aiResponse = parseAIResponse(result.message.content) as any;
      return {
        message: aiResponse.response,
        needsMoreInfo: false,
      };
    } else {
      console.log('[Copilot] AI provider not configured, using fallback');
    }
  } catch (error) {
    console.error('[Copilot] AI error for analytics:', error);
  }

  // Fallback: Generate rule-based analytical response
  if (summary.byCategory.length === 0) {
    return {
      message:
        "Hmm, you don't have any transactions recorded yet. Tell me what you spent today and let's start tracking! 📊",
      needsMoreInfo: false,
    };
  }

  const topCategory = summary.byCategory[0];
  const topThree = summary.byCategory.slice(0, 3);
  const percentOfTotal = (
    (topCategory.total / summary.totalExpenses) *
    100
  ).toFixed(0);

  let response = `📊 Alright, let's look at your numbers...\n\n`;
  response += `In the last 30 days you spent $${summary.totalExpenses.toFixed(2)}\n\n`;
  response += `Your biggest spending is ${topCategory.emoji || ''} ${topCategory.name} at $${topCategory.total.toFixed(2)} (${percentOfTotal}% of total) 👀\n\n`;

  if (topThree.length > 1) {
    response += `Top 3 categories:\n`;
    topThree.forEach((c, i) => {
      response += `${i + 1}. ${c.emoji || ''} ${c.name}: $${c.total.toFixed(2)}\n`;
    });
  }

  if (summary.totalIncome > 0) {
    const savings = summary.totalIncome - summary.totalExpenses;
    if (savings > 0) {
      response += `\n💪 Nice! You saved $${savings.toFixed(2)} this month.`;
    } else {
      response += `\n⚠️ Heads up: you spent $${Math.abs(savings).toFixed(2)} more than you earned.`;
    }
  }

  return {
    message: response,
    needsMoreInfo: false,
  };
}

/**
 * Generate advice response based on user data and question
 */
async function processAdviceQuestion(
  db: any,
  userId: string,
  userMessage: string,
  conversationHistory: Message[]
): Promise<CopilotResponse> {
  // Get spending summary for context
  const summary = await getSpendingSummary(db, userId);

  // Get user profile for financial info
  const profile = await getOrCreateUserProfile(db, userId);

  // Build context for AI
  const dataContext = `
USER DATA:
- Monthly salary: ${profile.monthlySalaryCents ? `$${(profile.monthlySalaryCents / 100).toFixed(2)}` : 'Not specified'}
- Pay frequency: ${profile.payFrequency || 'Not specified'}
- Monthly savings goal: ${profile.monthlySavingsGoalCents ? `$${(profile.monthlySavingsGoalCents / 100).toFixed(2)}` : 'Not specified'}

LAST 30 DAYS SUMMARY:
- Total spent: $${summary.totalExpenses.toFixed(2)}
- Total income: $${summary.totalIncome.toFixed(2)}
- Balance: $${(summary.totalIncome - summary.totalExpenses).toFixed(2)}

TOP EXPENSES:
${summary.byCategory
  .slice(0, 5)
  .map((c, i) => `${i + 1}. ${c.emoji || ''} ${c.name}: $${c.total.toFixed(2)}`)
  .join('\n')}
`;

  const advicePrompt = `${SYSTEM_PROMPT}

${dataContext}

The user is asking for financial advice or recommendations. Use the data above to give personalized, specific, and practical advice. Be motivating but realistic.

COMMON TOPICS AND HOW TO RESPOND:
- Emergency fund: Recommend 3-6 months of expenses. Calculate based on their spending.
- Savings: Suggest the 50/30/20 rule or a percentage based on their situation.
- Cutting expenses: Identify categories where they spend a lot and suggest alternatives.
- Investments: Only mention if they already have an emergency fund. Suggest starting simple.
- Debt: Prioritize paying off high-interest debt first.

Respond with JSON:
{
  "understood": true,
  "isAdviceQuestion": true,
  "response": "your personalized advice with specific user data"
}`;

  // Try AI first
  try {
    const provider = getProvider();
    console.log(
      `[Copilot] AI provider: ${provider.name}, configured: ${provider.isConfigured()}`
    );
    if (provider.isConfigured()) {
      const messages: Message[] = [
        { role: 'system', content: advicePrompt },
        ...conversationHistory,
        { role: 'user', content: userMessage },
      ];
      console.log('[Copilot] Calling AI for advice question...');
      const result = await provider.chat(messages, {
        temperature: 0.6,
        maxTokens: 1000,
      });
      console.log('[Copilot] AI response received');
      const aiResponse = parseAIResponse(result.message.content) as any;
      return {
        message: aiResponse.response,
        needsMoreInfo: false,
      };
    } else {
      console.log('[Copilot] AI provider not configured, using fallback');
    }
  } catch (error) {
    console.error('[Copilot] AI error for advice:', error);
  }

  // Fallback: Generate rule-based advice
  const lowerMessage = userMessage.toLowerCase();
  let response = '';

  // Detect what type of advice they want
  if (lowerMessage.includes('emergency') || lowerMessage.includes('fund')) {
    // Emergency fund advice
    const monthlyExpenses = summary.totalExpenses;
    const recommendedFund3 = monthlyExpenses * 3;
    const recommendedFund6 = monthlyExpenses * 6;

    response = `💡 Emergency Fund\n\n`;
    response += `Based on your expenses of $${monthlyExpenses.toFixed(2)}/month, I recommend:\n\n`;
    response += `• Minimum: $${recommendedFund3.toFixed(2)} (3 months of expenses)\n`;
    response += `• Ideal: $${recommendedFund6.toFixed(2)} (6 months of expenses)\n\n`;

    if (profile.monthlySalaryCents) {
      const salary = profile.monthlySalaryCents / 100;
      const suggested20 = salary * 0.2;
      const monthsTo3 = Math.ceil(recommendedFund3 / suggested20);
      response += `If you save 20% of your salary ($${suggested20.toFixed(2)}/month), you'd reach your goal in ~${monthsTo3} months 💪\n\n`;
    }

    response += `Tip: Open a separate account ONLY for emergencies. Don't touch it unless it's a real emergency!`;
  } else if (lowerMessage.includes('sav')) {
    // Savings advice
    response = `🐷 Tips for Saving\n\n`;

    if (summary.byCategory.length > 0) {
      const topSpending = summary.byCategory[0];
      response += `Your biggest expense is ${topSpending.emoji || ''} ${topSpending.name} ($${topSpending.total.toFixed(2)}). `;

      if (
        topSpending.name.toLowerCase().includes('restaurant') ||
        topSpending.name.toLowerCase().includes('coffee') ||
        topSpending.name.toLowerCase().includes('food')
      ) {
        response += `Have you thought about cooking more at home? You could save up to 50% 🍳\n\n`;
      } else if (
        topSpending.name.toLowerCase().includes('streaming') ||
        topSpending.name.toLowerCase().includes('subscript')
      ) {
        response += `Check if you use all those subscriptions. Cancel the ones you don't! 📺\n\n`;
      } else {
        response += `Look for cheaper alternatives or reduce the frequency.\n\n`;
      }
    }

    response += `The 50/30/20 rule:\n`;
    response += `• 50% needs (rent, utilities, food)\n`;
    response += `• 30% wants (entertainment, restaurants)\n`;
    response += `• 20% savings and investments\n\n`;

    if (profile.monthlySalaryCents) {
      const salary = profile.monthlySalaryCents / 100;
      response += `With your salary, that would be ~$${(salary * 0.2).toFixed(2)}/month for savings.`;
    }
  } else if (
    lowerMessage.includes('invest') ||
    lowerMessage.includes('investment')
  ) {
    // Investment advice
    response = `📈 About Investments\n\n`;
    response += `Before investing, make sure you have:\n`;
    response += `1. ✅ Emergency fund (3-6 months of expenses)\n`;
    response += `2. ✅ High-interest debt paid off\n\n`;
    response += `If you have that covered, start simple:\n`;
    response += `• Beginner: Low-cost index funds (ETFs)\n`;
    response += `• Diversify: Don't put everything in one basket\n`;
    response += `• Long term: Invest money you won't need for 5+ years\n\n`;
    response += `⚠️ Never invest money you can't afford to lose. Do your research first!`;
  } else {
    // General financial advice
    response = `💰 General Tips\n\n`;

    if (
      summary.totalIncome > 0 &&
      summary.totalExpenses > summary.totalIncome
    ) {
      response += `⚠️ You're spending more than you earn. Priority #1: cut expenses.\n\n`;
    }

    response += `Financial priority order:\n`;
    response += `1. 🏦 Emergency fund (3-6 months)\n`;
    response += `2. 💳 Pay off debt (starting with highest interest)\n`;
    response += `3. 🐷 Save 20% of your income\n`;
    response += `4. 📈 Invest for the future\n\n`;
    response += `What specific topic would you like to dive deeper into? 🤔`;
  }

  return {
    message: response,
    needsMoreInfo: false,
  };
}

/**
 * Process a user message and extract transaction info
 */
export async function processMessage(
  userId: string,
  userMessage: string,
  conversationHistory: Message[] = []
): Promise<CopilotResponse> {
  const db = await getDb();

  // Check if user needs onboarding
  const onboardingStatus = await needsOnboarding(db, userId);
  if (onboardingStatus.needs) {
    return processOnboardingResponse(
      db,
      userId,
      userMessage,
      onboardingStatus.step
    );
  }

  // Check if this is an advice/recommendation question (check FIRST - more specific)
  if (isAdviceQuestion(userMessage)) {
    return processAdviceQuestion(db, userId, userMessage, conversationHistory);
  }

  // Check if this is an analytical question
  if (isAnalyticalQuestion(userMessage)) {
    return processAnalyticalQuestion(
      db,
      userId,
      userMessage,
      conversationHistory
    );
  }

  // Get user's categories for context
  const userCategories = await db
    .select()
    .from(categories)
    .where(eq(categories.userId, userId));

  // Get user's default account (or create one if none exists)
  const userAccounts = await db
    .select()
    .from(accounts)
    .where(eq(accounts.userId, userId));

  let defaultAccount = userAccounts[0];

  // Auto-create "Cash" account if no accounts exist
  if (!defaultAccount) {
    const newAccount = await accountRepo.createAccount(db, {
      userId,
      name: 'Cash',
      type: 'cash',
    });
    if (!newAccount) {
      return {
        message: 'Error creating account. Please try again.',
        needsMoreInfo: false,
      };
    }
    // Save database after creating account
    saveDatabase();
    defaultAccount = newAccount;
  }

  // Build messages for AI
  const messages: Message[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...conversationHistory,
    { role: 'user', content: userMessage },
  ];

  // Try to use AI for extraction
  let aiResponse: any = null;
  try {
    const provider = getProvider();
    console.log(
      `[Copilot] AI provider: ${provider.name}, configured: ${provider.isConfigured()}`
    );
    if (provider.isConfigured()) {
      console.log('[Copilot] Calling AI for transaction extraction...');
      const result = await provider.chat(messages, {
        temperature: 0.3,
        maxTokens: 500,
      });
      console.log('[Copilot] AI response received');
      aiResponse = parseAIResponse(result.message.content) as any;
    } else {
      console.log(
        '[Copilot] AI provider not configured, using rule-based extraction'
      );
    }
  } catch (error) {
    console.error('[Copilot] AI error for extraction:', error);
  }

  // Check if AI detected an analytical question
  if (aiResponse?.isAnalyticalQuestion) {
    return processAnalyticalQuestion(
      db,
      userId,
      userMessage,
      conversationHistory
    );
  }

  // If AI is not available, use rule-based extraction
  if (!aiResponse) {
    aiResponse = extractTransactionFromText(userMessage);
  }

  // If we need more info, return follow-up question
  if (aiResponse.needsMoreInfo) {
    return {
      message: aiResponse.followUpQuestion || aiResponse.response,
      needsMoreInfo: true,
      missingFields: aiResponse.missingFields || [],
    };
  }

  // If we understood the transaction
  if (aiResponse.understood && aiResponse.transaction) {
    const txData = aiResponse.transaction;

    // Find or suggest category
    let categoryId: string | null = null;
    let categoryName: string | null = txData.suggestedCategory || null;
    let categoryEmoji: string | null = txData.suggestedEmoji || null;
    let categoryAutoCreated = false;

    // Try to match with existing category
    if (categoryName) {
      const matchedCategory = userCategories.find(
        (c) => c.name.toLowerCase() === categoryName!.toLowerCase()
      );
      if (matchedCategory) {
        categoryId = matchedCategory.id;
        categoryName = matchedCategory.name;
      }
    }

    // If no category matched, try pattern matching with confidence check
    if (!categoryId) {
      // Find all matching categories
      const matchingCategories = findMatchingCategories(
        txData.description || userMessage
      );

      // If we have multiple good matches, ask user to confirm
      if (matchingCategories.length >= 2) {
        const topTwo = matchingCategories.slice(0, 2);
        // If confidence difference is small (both are plausible), ask user
        if (topTwo[0].confidence - topTwo[1].confidence < 0.3) {
          const formattedAmount = (Math.abs(txData.amountCents) / 100).toFixed(
            2
          );
          return {
            message: `$${formattedAmount} for "${txData.description}". Which category should I put it in: ${topTwo[0].emoji} ${topTwo[0].name} or ${topTwo[1].emoji} ${topTwo[1].name}?`,
            needsCategoryConfirmation: true,
            categoryOptions: topTwo.map((c) => ({
              name: c.name,
              emoji: c.emoji,
            })),
            pendingTransaction: {
              amountCents: txData.amountCents,
              description: txData.description,
              merchant: txData.merchant,
              date: txData.date || new Date().toISOString().split('T')[0],
              type: txData.type || 'expense',
            },
          };
        }
      }

      // Use the top match if we have one
      if (matchingCategories.length > 0) {
        const bestMatch = matchingCategories[0];
        const matchedCategory = userCategories.find(
          (c) => c.name.toLowerCase() === bestMatch.name.toLowerCase()
        );
        if (matchedCategory) {
          categoryId = matchedCategory.id;
          categoryName = matchedCategory.name;
        } else {
          categoryName = bestMatch.name;
          categoryEmoji = bestMatch.emoji;
        }
      } else {
        // Fallback to single-match function
        const suggestedCategoryName = suggestCategoryFromText(
          txData.description || userMessage
        );
        if (suggestedCategoryName) {
          const matchedCategory = userCategories.find(
            (c) => c.name.toLowerCase() === suggestedCategoryName.toLowerCase()
          );
          if (matchedCategory) {
            categoryId = matchedCategory.id;
            categoryName = matchedCategory.name;
          } else {
            categoryName = suggestedCategoryName;
            categoryEmoji =
              CATEGORY_CONFIG[suggestedCategoryName]?.emoji || null;
          }
        }
      }
    }

    // Auto-create category if it doesn't exist and we have a name
    if (!categoryId && categoryName) {
      // Get emoji from AI response or our config
      if (!categoryEmoji && CATEGORY_CONFIG[categoryName]) {
        categoryEmoji = CATEGORY_CONFIG[categoryName].emoji;
      }
      // Default emoji based on transaction type
      if (!categoryEmoji) {
        categoryEmoji = txData.type === 'income' ? '💰' : '📦';
      }

      try {
        const newCategory = await categoryRepo.createCategory(db, {
          userId,
          name: categoryName,
          emoji: categoryEmoji,
        });
        if (newCategory) {
          categoryId = newCategory.id;
          categoryAutoCreated = true;
          // Save database after creating category
          saveDatabase();
        }
      } catch (error) {
        console.log('Failed to auto-create category:', error);
      }
    }

    const transaction: ExtractedTransaction = {
      amountCents: txData.amountCents,
      description: txData.description,
      merchant: txData.merchant,
      date: txData.date || new Date().toISOString().split('T')[0],
      categoryId,
      categoryName,
      type: txData.type || 'expense',
      notes: null,
    };

    // Create the transaction
    const newTransaction = await transactionRepo.createTransaction(db, {
      userId,
      date: transaction.date,
      description: transaction.description,
      amountCents:
        transaction.type === 'expense'
          ? -Math.abs(transaction.amountCents)
          : Math.abs(transaction.amountCents),
      type: transaction.type,
      categoryId: transaction.categoryId,
      accountId: defaultAccount.id,
      cleared: false,
      notes: transaction.merchant ? `Merchant: ${transaction.merchant}` : null,
    });

    // Save database after mutation
    saveDatabase();

    const formattedAmount = (Math.abs(transaction.amountCents) / 100).toFixed(
      2
    );
    const categoryText = categoryName
      ? ` in ${categoryEmoji || ''} ${categoryName}`
      : '';
    const categoryCreatedText = categoryAutoCreated
      ? ` (created this category for you!)`
      : '';

    // Generate a sassy response based on transaction type and amount
    let sassyResponse = aiResponse.response;
    if (!sassyResponse) {
      if (transaction.type === 'income') {
        const incomeResponses = [
          `Yes! $${formattedAmount} coming in 💰 ${categoryText}. Time to invest some of it!`,
          `Niceee! $${formattedAmount}${categoryText}. Have you thought about how much you'll save? 🐷`,
          `Ka-ching! $${formattedAmount}${categoryText}. Remember: pay off your debts first 😉`,
        ];
        sassyResponse =
          incomeResponses[Math.floor(Math.random() * incomeResponses.length)];
      } else {
        const amountDollars = Math.abs(transaction.amountCents) / 100;
        if (amountDollars < 20) {
          const smallResponses = [
            `Done! $${formattedAmount}${categoryText}. Small expenses add up, watch out 👀`,
            `Noted! $${formattedAmount}${categoryText}.`,
          ];
          sassyResponse =
            smallResponses[Math.floor(Math.random() * smallResponses.length)];
        } else if (amountDollars < 100) {
          const mediumResponses = [
            `$${formattedAmount}${categoryText}. Every dollar counts 💪`,
            `Logged! $${formattedAmount}${categoryText}. Was that planned? 🤔`,
          ];
          sassyResponse =
            mediumResponses[Math.floor(Math.random() * mediumResponses.length)];
        } else {
          const largeResponses = [
            `Oof, $${formattedAmount}${categoryText} 💸 Was that in the budget?`,
            `$${formattedAmount}${categoryText}. That one stung... 🫣`,
            `Well well, $${formattedAmount}${categoryText}. I hope it was worth it 😅`,
          ];
          sassyResponse =
            largeResponses[Math.floor(Math.random() * largeResponses.length)];
        }
      }
    }

    if (categoryAutoCreated) {
      sassyResponse += categoryCreatedText;
    }

    return {
      message: sassyResponse,
      transaction,
      transactionCreated: true,
      transactionId: newTransaction?.id,
      suggestedCategories: userCategories
        .filter((c) => c.id !== categoryId)
        .slice(0, 5)
        .map((c) => ({ id: c.id, name: c.name, emoji: c.emoji })),
    };
  }

  // Fallback response with personality
  const fallbackResponses = [
    'Can you tell me the amount and what you spent on? 🤔',
    "Hey, I didn't quite get that. How much was it and what for?",
    'Hmm, I need more info. Amount and description? 💭',
  ];
  return {
    message:
      aiResponse.response ||
      fallbackResponses[Math.floor(Math.random() * fallbackResponses.length)],
    needsMoreInfo: true,
    missingFields: ['amount', 'description'],
  };
}

/**
 * Parse a money string into cents
 * Handles formats like:
 * - $2,500.00 -> 250000 (commas as thousands, period as decimal)
 * - $2500 -> 250000 (no separators)
 * - $2.50 -> 250 (period as decimal)
 * - $2,50 -> 250 (European format, comma as decimal)
 */
function parseMoneyToCents(moneyStr: string): number {
  // Remove currency symbols and whitespace
  let cleaned = moneyStr.replace(/[$\s]/g, '');

  // Check if it has both comma and period
  const hasComma = cleaned.includes(',');
  const hasPeriod = cleaned.includes('.');

  if (hasComma && hasPeriod) {
    // Format like 2,500.00 - comma is thousands separator, period is decimal
    cleaned = cleaned.replace(/,/g, '');
    const amount = parseFloat(cleaned);
    return Math.round(amount * 100);
  } else if (hasComma) {
    // Could be 2,500 (thousands) or 2,50 (European decimal)
    // If 3 digits after comma, it's thousands separator
    const parts = cleaned.split(',');
    if (parts.length === 2 && parts[1].length === 3) {
      // 2,500 -> 2500
      cleaned = cleaned.replace(/,/g, '');
      return Math.round(parseFloat(cleaned) * 100);
    } else {
      // 2,50 -> 2.50 (European format)
      cleaned = cleaned.replace(',', '.');
      return Math.round(parseFloat(cleaned) * 100);
    }
  } else if (hasPeriod) {
    // Check if it looks like thousands (2.500) or decimal (2.50)
    const parts = cleaned.split('.');
    if (parts.length === 2 && parts[1].length === 3) {
      // 2.500 -> 2500 (some locales use period as thousands separator)
      cleaned = cleaned.replace(/\./g, '');
      return Math.round(parseFloat(cleaned) * 100);
    } else {
      // Normal decimal like 2.50
      return Math.round(parseFloat(cleaned) * 100);
    }
  }

  // No separators - just a number
  return Math.round(parseFloat(cleaned) * 100);
}

/**
 * Rule-based transaction extraction (fallback when AI is not available)
 */
function extractTransactionFromText(text: string): any {
  const lowerText = text.toLowerCase();

  // Extract amount - patterns like "$50", "$2,500", "$2,500.00", "50 dollars"
  const amountPatterns = [
    // $2,500.00 or $2500.00 or $2,500 or $2500
    /\$\s*([\d,]+(?:\.\d{1,2})?)/,
    // 2,500 dollars or 2500 dollars
    /([\d,]+(?:\.\d{1,2})?)\s*(?:dollars?|bucks?|usd)/i,
    // spent 2500 or spent $2500
    /spent?\s+\$?([\d,]+(?:\.\d{1,2})?)/i,
    // 2500 on or 2500 for
    /([\d,]+(?:\.\d{1,2})?)\s+(?:on|for)/i,
    // paid me 2500 or paid $2500
    /paid?\s+(?:me\s+)?\$?([\d,]+(?:\.\d{1,2})?)/i,
    // paycheck 2500 or paycheck of $2500
    /paycheck\s+(?:of\s+)?\$?([\d,]+(?:\.\d{1,2})?)/i,
    // salary 2500 or salary of $2500
    /salary\s+(?:of\s+)?\$?([\d,]+(?:\.\d{1,2})?)/i,
  ];

  let amountCents: number | null = null;
  for (const pattern of amountPatterns) {
    const match = text.match(pattern);
    if (match) {
      amountCents = parseMoneyToCents(match[1]);
      break;
    }
  }

  // Extract date
  let date = new Date().toISOString().split('T')[0];
  if (lowerText.includes('yesterday')) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    date = yesterday.toISOString().split('T')[0];
  } else if (
    lowerText.includes('day before yesterday') ||
    lowerText.includes('two days ago')
  ) {
    const dayBeforeYesterday = new Date();
    dayBeforeYesterday.setDate(dayBeforeYesterday.getDate() - 2);
    date = dayBeforeYesterday.toISOString().split('T')[0];
  }

  // Determine if it's income or expense
  const isIncome =
    /receiv(ed|e)|collect(ed)?|earn(ed)?|income|salary|paycheck|wages|payment.*received|got\s+paid|deposit(ed)?|bonus|transfer.*receiv/i.test(
      lowerText
    );
  const type = isIncome ? 'income' : 'expense';

  // Extract description - what they spent on
  let description = '';
  let merchant: string | null = null;

  // Common patterns for what was purchased
  const descPatterns = [
    /(?:on|for|at)\s+(.+?)(?:\s+for|\s+at|\s+with|\s+\$|$)/i,
    /spent?\s+(?:\$?\d+(?:[.,]\d{2})?)\s+(?:on|for|at)\s+(.+)/i,
    /bought\s+(.+?)(?:\s+for|\s+at|\s+\$|$)/i,
  ];

  for (const pattern of descPatterns) {
    const match = text.match(pattern);
    if (match) {
      description = match[1].trim();
      break;
    }
  }

  // If no description found, use the whole text cleaned up
  if (!description) {
    description =
      text
        .replace(/\$?\d+(?:[.,]\d{2})?/g, '')
        .replace(/today|yesterday|day before yesterday/gi, '')
        .replace(/spent?/gi, '')
        .trim() || 'Expense';
  }

  // Try to extract merchant name (capitalized words, brand names)
  const merchantMatch = text.match(
    /(?:at|from)\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)?)/
  );
  if (merchantMatch) {
    merchant = merchantMatch[1];
  }

  // Suggest category
  const suggestedCategory = suggestCategoryFromText(text);

  // Determine if we have enough info
  const needsMoreInfo = !amountCents;
  const missingFields: string[] = [];
  if (!amountCents) missingFields.push('amount');

  if (needsMoreInfo) {
    const needsInfoResponses = [
      'Hey, how much was it?',
      'How much did you spend? 🤔',
      "I'm missing the amount!",
    ];
    return {
      understood: false,
      needsMoreInfo: true,
      missingFields,
      followUpQuestion: 'How much did you spend?',
      response:
        needsInfoResponses[
          Math.floor(Math.random() * needsInfoResponses.length)
        ],
    };
  }

  // Get emoji for the category
  const categoryEmoji = suggestedCategory
    ? CATEGORY_CONFIG[suggestedCategory]?.emoji ||
      (type === 'income' ? '💰' : '📦')
    : null;

  return {
    understood: true,
    needsMoreInfo: false,
    transaction: {
      amountCents,
      description: description.charAt(0).toUpperCase() + description.slice(1),
      merchant,
      date,
      type,
      suggestedCategory,
      suggestedEmoji: categoryEmoji,
    },
    response: null, // Let the main function handle the sassy response
  };
}

/**
 * Suggest a category based on text patterns
 */
function suggestCategoryFromText(text: string): string | null {
  const lowerText = text.toLowerCase();

  for (const [category, patterns] of Object.entries(CATEGORY_PATTERNS)) {
    for (const pattern of patterns) {
      if (lowerText.includes(pattern)) {
        return category;
      }
    }
  }

  return null;
}

/**
 * Get conversation suggestions/quick actions
 */
export function getQuickActions(): Array<{ text: string; example: string }> {
  return [
    { text: 'Log expense', example: 'Spent $30 on lunch' },
    { text: 'Shopping', example: 'Bought clothes for $150 at Zara' },
    { text: 'Transportation', example: '$15 Uber ride' },
    { text: 'Groceries', example: 'Groceries $80' },
  ];
}

/**
 * Update category for a recently created transaction
 */
export async function updateTransactionCategory(
  transactionId: string,
  categoryId: string,
  userId: string
): Promise<boolean> {
  const db = await getDb();

  // Verify transaction belongs to user
  const tx = await db
    .select()
    .from(transactions)
    .where(
      and(eq(transactions.id, transactionId), eq(transactions.userId, userId))
    );

  if (!tx.length) {
    return false;
  }

  await transactionRepo.updateTransaction(db, transactionId, { categoryId });
  return true;
}
