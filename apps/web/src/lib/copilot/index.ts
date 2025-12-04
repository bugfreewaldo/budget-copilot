/**
 * Budget Copilot - Intelligent Financial Agent
 *
 * A conversational AI agent that helps users:
 * - Register income and expenses through natural language
 * - Track and manage debts with smart strategies
 * - Get proactive financial advice and insights
 * - Understand spending patterns and suggest improvements
 *
 * Personality: Professional, empathetic, proactive, never judgmental
 */

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
  // Enhanced response fields
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

// ============================================================================
// INTENT DETECTION
// ============================================================================

/**
 * Detect the user's intent from their message
 */
function detectIntent(text: string): ConversationIntent {
  const lowerText = text.toLowerCase().trim();

  // Greetings
  if (
    /^(hola|hey|buenos?\s*d[ií]as?|buenas?\s*tardes?|buenas?\s*noches?|qué\s*tal|hi|hello)/i.test(
      lowerText
    )
  ) {
    return 'greeting';
  }

  // Help requests
  if (
    /ayuda|help|cómo\s+(funciona|uso|registro)|qué\s+puedo\s+hacer/i.test(
      lowerText
    )
  ) {
    return 'help';
  }

  // Debt registration
  if (
    /(?:tengo|debo|pago)\s+(?:una?\s+)?(?:deuda|préstamo|crédito|tarjeta)|registrar?\s+deuda/i.test(
      lowerText
    )
  ) {
    return 'debt_register';
  }

  // Debt inquiry
  if (
    /(?:cuánto|cuanto)\s+debo|mis?\s+deudas?|estado\s+de\s+(?:mis?\s+)?deudas?/i.test(
      lowerText
    )
  ) {
    return 'debt_inquiry';
  }

  // Balance/spending inquiry
  if (
    /(?:cuánto|cuanto)\s+(?:tengo|he\s+gastado|llevo)|mi\s+balance|resumen|gastos?\s+del?\s+mes/i.test(
      lowerText
    )
  ) {
    return 'spending_summary';
  }

  // Transaction (default for anything with numbers or transaction-related words)
  if (
    /\$?\d+|gast[eéo]|compr[eéo]|pagu[eé]|recib[íi]|cobr[eé]|quincena|salario|sueldo|ingreso/i.test(
      lowerText
    )
  ) {
    return 'transaction';
  }

  return 'unknown';
}

// Category mapping with emojis
const CATEGORY_CONFIG: Record<string, { patterns: string[]; emoji: string }> = {
  Compras: {
    patterns: [
      'ropa',
      'zapatos',
      'nike',
      'zara',
      'tienda',
      'mall',
      'amazon',
      'compré',
      'compras',
    ],
    emoji: '🛍️',
  },
  Supermercado: {
    patterns: [
      'super',
      'supermercado',
      'mercado',
      'walmart',
      'costco',
      'alimentos',
      'groceries',
    ],
    emoji: '🛒',
  },
  Restaurantes: {
    patterns: [
      'restaurante',
      'almuerzo',
      'cena',
      'desayuno',
      'pizza',
      'sushi',
      'hamburguesa',
      'mcdonald',
      'comí',
      'comida',
    ],
    emoji: '🍽️',
  },
  Café: {
    patterns: ['café', 'coffee', 'starbucks', 'cafetería', 'latte'],
    emoji: '☕',
  },
  Transporte: {
    patterns: [
      'uber',
      'taxi',
      'gasolina',
      'gas',
      'metro',
      'bus',
      'transporte',
      'didi',
    ],
    emoji: '🚗',
  },
  Entretenimiento: {
    patterns: [
      'cine',
      'juegos',
      'concierto',
      'película',
      'fiesta',
      'bar',
      'club',
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
      'streaming',
    ],
    emoji: '📺',
  },
  Salud: {
    patterns: [
      'farmacia',
      'medicina',
      'doctor',
      'hospital',
      'dentista',
      'médico',
    ],
    emoji: '🏥',
  },
  Servicios: {
    patterns: [
      'luz',
      'agua',
      'internet',
      'teléfono',
      'electricidad',
      'factura',
    ],
    emoji: '💡',
  },
  Gimnasio: {
    patterns: ['gym', 'gimnasio', 'fitness', 'ejercicio', 'yoga', 'deporte'],
    emoji: '💪',
  },
  Salario: {
    patterns: [
      'salario',
      'sueldo',
      'quincena',
      'pago',
      'nómina',
      'ingreso',
      'trabajo',
    ],
    emoji: '💰',
  },
  Freelance: {
    patterns: [
      'freelance',
      'proyecto',
      'cliente',
      'trabajo extra',
      'consultoría',
    ],
    emoji: '💻',
  },
};

/**
 * Parse money string to cents
 */
function parseMoneyToCents(moneyStr: string): number {
  let cleaned = moneyStr.replace(/[$\s]/g, '');
  const hasComma = cleaned.includes(',');
  const hasPeriod = cleaned.includes('.');

  if (hasComma && hasPeriod) {
    cleaned = cleaned.replace(/,/g, '');
    return Math.round(parseFloat(cleaned) * 100);
  } else if (hasComma) {
    const parts = cleaned.split(',');
    const decimalPart = parts[1];
    if (parts.length === 2 && decimalPart && decimalPart.length === 3) {
      cleaned = cleaned.replace(/,/g, '');
      return Math.round(parseFloat(cleaned) * 100);
    } else {
      cleaned = cleaned.replace(',', '.');
      return Math.round(parseFloat(cleaned) * 100);
    }
  } else if (hasPeriod) {
    const parts = cleaned.split('.');
    const decimalPart = parts[1];
    if (parts.length === 2 && decimalPart && decimalPart.length === 3) {
      cleaned = cleaned.replace(/\./g, '');
      return Math.round(parseFloat(cleaned) * 100);
    }
    return Math.round(parseFloat(cleaned) * 100);
  }

  return Math.round(parseFloat(cleaned) * 100);
}

/**
 * Suggest category from text
 */
function suggestCategoryFromText(
  text: string
): { name: string; emoji: string } | null {
  const lowerText = text.toLowerCase();

  for (const [categoryName, config] of Object.entries(CATEGORY_CONFIG)) {
    for (const pattern of config.patterns) {
      if (lowerText.includes(pattern)) {
        return { name: categoryName, emoji: config.emoji };
      }
    }
  }

  return null;
}

/**
 * Extract transaction from text (rule-based)
 */
function extractTransactionFromText(text: string): {
  understood: boolean;
  needsMoreInfo: boolean;
  transaction?: {
    amountCents: number;
    description: string;
    merchant: string | null;
    date: string;
    type: 'income' | 'expense';
    suggestedCategory: string | null;
    suggestedEmoji: string | null;
  };
  followUpQuestion?: string;
  missingFields?: string[];
} {
  const lowerText = text.toLowerCase();

  // Extract amount - more flexible patterns for Spanish
  const amountPatterns = [
    // $2400 or $ 2,400.00
    /\$\s*([\d,]+(?:\.\d{1,2})?)/,
    // 2400 pesos/dólares/usd
    /([\d,]+(?:\.\d{1,2})?)\s*(?:dólares?|dolares?|pesos?|usd)/i,
    // gasté/gasto 2400
    /gast[eéo]\s+\$?([\d,]+(?:\.\d{1,2})?)/i,
    // de 2400, por 2400 (preposition BEFORE number - common in Spanish)
    /(?:de|por)\s+\$?([\d,.]+)/i,
    // 2400 en/de something
    /([\d,]+(?:\.\d{1,2})?)\s+(?:en|de)/i,
    // cobré/recibí/gané 2400
    /(?:cobr[eé]|recib[ií]|gan[eé]|pagar?on?)\s+\$?([\d,.]+)/i,
    // ingreso de/por NUMBER or just ingreso NUMBER
    /ingreso\s+(?:de\s+|por\s+)?\$?([\d,.]+)/i,
    // Just a number at end of sentence (fallback for simple cases like "quincena de 2400")
    /\b([\d]{3,}(?:[.,]\d+)?)\s*$/,
    // Any standalone number 100+ that looks like money (last resort)
    /\b([\d]{3,}(?:[.,]\d{1,2})?)\b/,
  ];

  let amountCents: number | null = null;
  for (const pattern of amountPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const parsed = parseMoneyToCents(match[1]);
      // Sanity check: amount should be reasonable (1 cent to 10 million)
      if (parsed > 0 && parsed <= 1000000000) {
        amountCents = parsed;
        break;
      }
    }
  }

  // Extract date
  let date =
    new Date().toISOString().split('T')[0] ??
    new Date().toISOString().slice(0, 10);
  if (lowerText.includes('ayer')) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    date =
      yesterday.toISOString().split('T')[0] ??
      yesterday.toISOString().slice(0, 10);
  }

  // Determine income or expense - expanded patterns
  const incomePatterns = [
    /recib[íi]/i, // recibí
    /cobr[eé]/i, // cobré
    /gan[eé]/i, // gané
    /ingreso/i, // ingreso
    /salario/i, // salario
    /quincena/i, // quincena
    /sueldo/i, // sueldo
    /me\s+pagar?on?/i, // me pagaron
    /deposit[oó]/i, // depósito/deposito
    /transferencia/i, // transferencia (could be either, but often income)
    /bonificaci[oó]n/i, // bonificación
    /bono/i, // bono
    /reembolso/i, // reembolso
    /devoluci[oó]n/i, // devolución
    /entrada\s+de\s+dinero/i, // entrada de dinero
    /me\s+(?:dieron|transfirieron|depositaron)/i, // me dieron/transfirieron/depositaron
  ];
  const isIncome = incomePatterns.some((p) => p.test(lowerText));
  const type = isIncome ? 'income' : 'expense';

  // Extract description based on type (income vs expense)
  let description = '';

  if (isIncome) {
    // Income-specific description patterns
    const incomeDescPatterns = [
      // "quincena de trabajo", "salario del mes", "sueldo de diciembre"
      /(?:quincena|salario|sueldo|bono|bonificación|reembolso)(?:\s+(?:de|del)\s+(.+?))?(?:\s+(?:de|por)\s+\$?[\d,.]+|$)/i,
      // "me pagaron mi quincena" -> extract "quincena"
      /me\s+pagar?on?\s+(?:mi\s+)?(.+?)(?:\s+(?:de|por)\s+\$?[\d,.]+|$)/i,
      // "recibí el pago de freelance" -> "pago de freelance"
      /recib[ií]\s+(?:el\s+|un\s+)?(.+?)(?:\s+(?:de|por)\s+\$?[\d,.]+|$)/i,
      // "cobré proyecto", "cobré trabajo extra"
      /cobr[eé]\s+(?:el\s+|un\s+|mi\s+)?(.+?)(?:\s+(?:de|por)\s+\$?[\d,.]+|$)/i,
      // "ingreso de trabajo" or "ingreso por freelance"
      /ingreso\s+(?:de|por)\s+(.+?)(?:\s+\$?[\d,.]+|$)/i,
    ];

    for (const pattern of incomeDescPatterns) {
      const match = text.match(pattern);
      if (match && match[1] && match[1].trim()) {
        description = match[1].trim();
        break;
      }
    }

    // If no specific description found, try to extract key income word
    if (!description) {
      const incomeKeywords = [
        'quincena',
        'salario',
        'sueldo',
        'nómina',
        'bono',
        'bonificación',
        'reembolso',
        'devolución',
        'freelance',
        'proyecto',
        'trabajo',
        'pago',
        'transferencia',
        'depósito',
      ];
      for (const keyword of incomeKeywords) {
        if (lowerText.includes(keyword)) {
          description = keyword.charAt(0).toUpperCase() + keyword.slice(1);
          break;
        }
      }
    }

    // Final fallback for income
    if (!description) {
      description = 'Ingreso';
    }
  } else {
    // Expense description patterns
    const descPatterns = [
      /(?:en|de)\s+(.+?)(?:\s+por|\s+en|\s+\$|$)/i,
      /gast[eéo]\s+(?:\$?\d+(?:[.,]\d{2})?)\s+(?:en|de)\s+(.+)/i,
      /compr[eéo]\s+(.+?)(?:\s+por|\s+en|\s+\$|$)/i,
    ];

    for (const pattern of descPatterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        description = match[1].trim();
        break;
      }
    }

    if (!description) {
      description =
        text
          .replace(/\$?\d+(?:[.,]\d{2})?/g, '')
          .replace(/gast[eéo]/gi, '')
          .trim() || 'Gasto';
    }
  }

  // Need more info if no amount
  if (!amountCents) {
    return {
      understood: false,
      needsMoreInfo: true,
      missingFields: ['monto'],
      followUpQuestion: '¿Cuánto fue? 🤔',
    };
  }

  // Suggest category
  const category = suggestCategoryFromText(text);

  return {
    understood: true,
    needsMoreInfo: false,
    transaction: {
      amountCents,
      description: description.charAt(0).toUpperCase() + description.slice(1),
      merchant: null,
      date,
      type,
      suggestedCategory: category?.name || null,
      suggestedEmoji: category?.emoji || (type === 'income' ? '💰' : '📦'),
    },
  };
}

/**
 * Process a user message - Main entry point with intent-based routing
 */
export async function processMessage(
  userId: string,
  userMessage: string
): Promise<CopilotResponse> {
  // Detect user intent
  const intent = detectIntent(userMessage);

  // Generate proactive insights for some intents
  let insights: FinancialInsight[] = [];
  if (intent === 'greeting' || intent === 'unknown') {
    insights = await generateFinancialInsights(userId);
  }

  // Route based on intent
  switch (intent) {
    case 'greeting':
      return handleGreeting(userId, insights);

    case 'help':
      return handleHelp();

    case 'debt_register':
      return handleDebtRegistration(userId, userMessage);

    case 'debt_inquiry':
      return handleDebtInquiry(userId);

    case 'spending_summary':
      return handleSpendingSummary(userId);

    case 'transaction':
      return handleTransaction(userId, userMessage);

    case 'unknown':
    default: {
      // Try to handle as transaction first, otherwise ask for clarification
      const txResult = await handleTransaction(userId, userMessage);
      if (txResult.transactionCreated) {
        return txResult;
      }

      // If not a transaction, provide helpful response
      return {
        message: `No estoy seguro de qué quieres hacer. 🤔

Puedo ayudarte a:
• **Registrar gastos**: "Gasté $50 en el super"
• **Registrar ingresos**: "Me pagaron $2400"
• **Registrar deudas**: "Tengo una deuda de $5000"
• **Ver resumen**: "¿Cuánto he gastado?"
• **Ver deudas**: "¿Cuánto debo?"

¿Qué te gustaría hacer?`,
        intent: 'unknown',
        insights,
        followUpActions: [
          { label: 'Registrar gasto', type: 'quick_reply', value: 'Gasté $' },
          {
            label: 'Registrar ingreso',
            type: 'quick_reply',
            value: 'Recibí $',
          },
          {
            label: 'Ver resumen',
            type: 'quick_reply',
            value: '¿Cuánto he gastado?',
          },
        ],
      };
    }
  }
}

/**
 * Handle transaction registration (income or expense)
 */
async function handleTransaction(
  userId: string,
  userMessage: string
): Promise<CopilotResponse> {
  const db = getDb();

  // Get user's categories
  const userCategories = await db
    .select()
    .from(categories)
    .where(eq(categories.userId, userId));

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

  // Extract transaction from text
  const extracted = extractTransactionFromText(userMessage);

  if (extracted.needsMoreInfo) {
    return {
      message: extracted.followUpQuestion || '¿Cuánto fue? 🤔',
      intent: 'transaction',
      needsMoreInfo: true,
      missingFields: extracted.missingFields || [],
    };
  }

  if (extracted.understood && extracted.transaction) {
    const txData = extracted.transaction;

    // Find or create category
    let categoryId: string | null = null;
    const categoryName = txData.suggestedCategory;
    const categoryEmoji = txData.suggestedEmoji;

    if (categoryName) {
      const existingCategory = userCategories.find(
        (c) => c.name.toLowerCase() === categoryName!.toLowerCase()
      );
      if (existingCategory) {
        categoryId = existingCategory.id;
      } else {
        // Create new category
        const newCategoryId = nanoid();
        await db.insert(categories).values({
          id: newCategoryId,
          userId,
          name: categoryName,
          emoji: categoryEmoji,
          createdAt: Date.now(),
        });
        categoryId = newCategoryId;
      }
    }

    // Create transaction
    const transactionId = nanoid();
    const now = Date.now();

    await db.insert(transactions).values({
      id: transactionId,
      userId,
      date: txData.date,
      description: txData.description,
      amountCents:
        txData.type === 'expense'
          ? -Math.abs(txData.amountCents)
          : Math.abs(txData.amountCents),
      type: txData.type,
      categoryId,
      accountId: defaultAccount.id,
      cleared: false,
      notes: null,
      createdAt: now,
      updatedAt: now,
    });

    const transaction: ExtractedTransaction = {
      amountCents: txData.amountCents,
      description: txData.description,
      merchant: null,
      date: txData.date,
      categoryId,
      categoryName,
      type: txData.type,
      notes: null,
    };

    // Generate response with personality
    const formattedAmount = (Math.abs(txData.amountCents) / 100).toLocaleString(
      'en-US',
      {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }
    );
    const categoryText = categoryName
      ? ` en ${categoryEmoji || ''} ${categoryName}`
      : '';

    let message: string;
    if (txData.type === 'income') {
      const responses = [
        `¡Eso! Llegaron $${formattedAmount} 💰${categoryText}`,
        `Niceee! $${formattedAmount}${categoryText} 🎉`,
        `¡Dinero entrando! $${formattedAmount}${categoryText} 💵`,
      ] as const;
      message =
        responses[Math.floor(Math.random() * responses.length)] ?? responses[0];
    } else {
      const amount = Math.abs(txData.amountCents) / 100;
      if (amount < 20) {
        message = `Listo! $${formattedAmount}${categoryText} ✓`;
      } else if (amount < 100) {
        message = `Registrado! $${formattedAmount}${categoryText}. Cada peso cuenta 💪`;
      } else if (amount < 500) {
        const responses = [
          `Uff, $${formattedAmount}${categoryText} 💸`,
          `Bueno bueno, $${formattedAmount}${categoryText}. ¿Estaba en el presupuesto?`,
        ] as const;
        message =
          responses[Math.floor(Math.random() * responses.length)] ??
          responses[0];
      } else {
        const responses = [
          `Wow, $${formattedAmount}${categoryText} 😮 ¡Eso fue un gasto importante!`,
          `$${formattedAmount}${categoryText} 💸 Registrado. ¿Todo bien con el presupuesto?`,
        ] as const;
        message =
          responses[Math.floor(Math.random() * responses.length)] ??
          responses[0];
      }
    }

    return {
      message,
      intent: 'transaction',
      transaction,
      transactionCreated: true,
      transactionId,
      suggestedCategories: userCategories
        .filter((c) => c.id !== categoryId)
        .slice(0, 5)
        .map((c) => ({ id: c.id, name: c.name, emoji: c.emoji })),
      followUpActions: [
        { label: 'Otro gasto', type: 'quick_reply', value: 'Gasté $' },
        {
          label: 'Ver resumen',
          type: 'quick_reply',
          value: '¿Cuánto llevo gastado?',
        },
      ],
    };
  }

  return {
    message: '¿Puedes decirme el monto y en qué gastaste? 🤔',
    intent: 'transaction',
    needsMoreInfo: true,
    missingFields: ['amount', 'description'],
  };
}

/**
 * Update transaction category
 */
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

/**
 * Get quick action suggestions
 */
export function getQuickActions(): Array<{ text: string; example: string }> {
  return [
    { text: 'Registrar gasto', example: 'Gasté $30 en almuerzo' },
    { text: 'Compras', example: 'Compré ropa por $150 en Zara' },
    { text: 'Transporte', example: '$15 de Uber' },
    { text: 'Supermercado', example: 'Super $80' },
    { text: 'Ingreso', example: 'Me pagaron mi quincena de $2400' },
    {
      text: 'Registrar deuda',
      example: 'Tengo una deuda de $5000 con 18% de interés',
    },
    { text: 'Ver resumen', example: '¿Cuánto he gastado este mes?' },
    { text: 'Ver deudas', example: '¿Cuánto debo en total?' },
  ];
}

// ============================================================================
// GREETING HANDLER
// ============================================================================

/**
 * Generate a friendly greeting with optional proactive insights
 */
async function handleGreeting(
  userId: string,
  insights: FinancialInsight[]
): Promise<CopilotResponse> {
  const hour = new Date().getHours();
  let timeGreeting = 'Hola';
  if (hour >= 5 && hour < 12) timeGreeting = 'Buenos días';
  else if (hour >= 12 && hour < 19) timeGreeting = 'Buenas tardes';
  else timeGreeting = 'Buenas noches';

  const greetings = [
    `${timeGreeting}! 👋 Soy tu copiloto financiero. ¿En qué te ayudo?`,
    `${timeGreeting}! 💰 ¿Listo para tomar control de tus finanzas?`,
    `${timeGreeting}! ¿Qué movimiento financiero hacemos hoy?`,
  ];

  let message =
    greetings[Math.floor(Math.random() * greetings.length)] ?? greetings[0];

  // Add proactive insight if available
  if (insights.length > 0) {
    const topInsight =
      insights.find((i) => i.priority === 'high') || insights[0];
    if (topInsight) {
      message += `\n\n💡 ${topInsight.message}`;
    }
  }

  return {
    message,
    intent: 'greeting',
    insights,
    followUpActions: [
      { label: 'Registrar gasto', type: 'quick_reply', value: 'Gasté $' },
      { label: 'Registrar ingreso', type: 'quick_reply', value: 'Recibí $' },
      {
        label: 'Ver resumen',
        type: 'quick_reply',
        value: '¿Cuánto he gastado?',
      },
      { label: 'Ver deudas', type: 'quick_reply', value: '¿Cuánto debo?' },
    ],
  };
}

// ============================================================================
// HELP HANDLER
// ============================================================================

/**
 * Provide help and guidance on using the copilot
 */
function handleHelp(): CopilotResponse {
  const message = `¡Con gusto te explico! 🤓

**Puedo ayudarte con:**

📝 **Registrar transacciones**
• "Gasté $50 en el super"
• "Compré café por $5"
• "Me pagaron mi quincena de $2400"

💳 **Manejar deudas**
• "Tengo una deuda de tarjeta de $5000"
• "¿Cuánto debo en total?"
• "¿Cuál es la mejor estrategia para pagar?"

📊 **Ver tu situación**
• "¿Cuánto he gastado este mes?"
• "Dame mi resumen financiero"
• "¿Cómo van mis metas?"

Solo escríbeme de forma natural, yo entiendo 😉`;

  return {
    message,
    intent: 'help',
    followUpActions: [
      { label: 'Registrar gasto', type: 'quick_reply', value: 'Gasté $' },
      { label: 'Ver mis deudas', type: 'quick_reply', value: '¿Cuánto debo?' },
      {
        label: 'Resumen del mes',
        type: 'quick_reply',
        value: '¿Cuánto llevo gastado?',
      },
    ],
  };
}

// ============================================================================
// DEBT REGISTRATION HANDLER
// ============================================================================

interface DebtExtraction {
  understood: boolean;
  needsMoreInfo: boolean;
  debt?: {
    name: string;
    type:
      | 'credit_card'
      | 'personal_loan'
      | 'auto_loan'
      | 'mortgage'
      | 'student_loan'
      | 'medical'
      | 'other';
    currentBalanceCents: number;
    aprPercent: number | null;
    minimumPaymentCents: number | null;
  };
  missingFields?: string[];
  followUpQuestion?: string;
}

/**
 * Extract debt information from natural language
 */
function extractDebtFromText(text: string): DebtExtraction {
  const lowerText = text.toLowerCase();

  // Extract amount
  const amountPatterns = [
    /\$\s*([\d,]+(?:\.\d{1,2})?)/,
    /([\d,]+(?:\.\d{1,2})?)\s*(?:dólares?|pesos?)/i,
    /(?:de|por)\s+\$?([\d,.]+)/i,
    /debo\s+\$?([\d,.]+)/i,
    /deuda\s+(?:de\s+)?\$?([\d,.]+)/i,
  ];

  let amountCents: number | null = null;
  for (const pattern of amountPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      amountCents = parseMoneyToCents(match[1]);
      if (amountCents > 0 && amountCents <= 100000000000) break;
    }
  }

  // Extract APR/interest rate
  const aprPatterns = [
    /(\d+(?:\.\d+)?)\s*%/,
    /(?:tasa|interés|apr)\s*(?:de\s*)?(\d+(?:\.\d+)?)/i,
  ];

  let aprPercent: number | null = null;
  for (const pattern of aprPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      aprPercent = parseFloat(match[1]);
      if (aprPercent > 0 && aprPercent <= 100) break;
    }
  }

  // Detect debt type
  let type: DebtExtraction['debt'] extends undefined
    ? never
    : NonNullable<DebtExtraction['debt']>['type'] = 'other';
  let name = 'Deuda';

  if (/tarjeta\s*(?:de\s*)?(?:crédito)?/i.test(lowerText)) {
    type = 'credit_card';
    name = 'Tarjeta de crédito';
    // Try to extract card name
    const cardMatch = lowerText.match(
      /tarjeta\s+(?:de\s+)?(?:crédito\s+)?(?:de\s+)?(\w+)/i
    );
    if (
      cardMatch &&
      cardMatch[1] &&
      !['de', 'con', 'por'].includes(cardMatch[1].toLowerCase())
    ) {
      name = `Tarjeta ${cardMatch[1].charAt(0).toUpperCase() + cardMatch[1].slice(1)}`;
    }
  } else if (/préstamo\s*personal/i.test(lowerText)) {
    type = 'personal_loan';
    name = 'Préstamo personal';
  } else if (
    /préstamo\s*(?:de\s*)?(?:auto|carro|coche)/i.test(lowerText) ||
    /auto|carro|coche/i.test(lowerText)
  ) {
    type = 'auto_loan';
    name = 'Préstamo de auto';
  } else if (/hipoteca|casa|vivienda/i.test(lowerText)) {
    type = 'mortgage';
    name = 'Hipoteca';
  } else if (/estudiante|estudios|universidad|escuela/i.test(lowerText)) {
    type = 'student_loan';
    name = 'Préstamo estudiantil';
  } else if (/médic|hospital|salud|doctor/i.test(lowerText)) {
    type = 'medical';
    name = 'Deuda médica';
  } else if (/préstamo/i.test(lowerText)) {
    type = 'personal_loan';
    name = 'Préstamo';
  }

  // Need amount at minimum
  if (!amountCents) {
    return {
      understood: false,
      needsMoreInfo: true,
      missingFields: ['monto'],
      followUpQuestion: '¿Cuánto es el monto de la deuda? 🤔',
    };
  }

  return {
    understood: true,
    needsMoreInfo: false,
    debt: {
      name,
      type,
      currentBalanceCents: amountCents,
      aprPercent,
      minimumPaymentCents: null,
    },
  };
}

/**
 * Register a new debt from natural language
 */
async function handleDebtRegistration(
  userId: string,
  userMessage: string
): Promise<CopilotResponse> {
  const extracted = extractDebtFromText(userMessage);

  if (extracted.needsMoreInfo) {
    return {
      message: extracted.followUpQuestion || '¿Cuánto es el monto de la deuda?',
      intent: 'debt_register',
      needsMoreInfo: true,
      missingFields: extracted.missingFields || [],
    };
  }

  if (!extracted.debt) {
    return {
      message:
        'No pude entender los detalles de la deuda. ¿Puedes decirme el monto y tipo?',
      intent: 'debt_register',
      needsMoreInfo: true,
    };
  }

  const db = getDb();
  const id = nanoid();
  const now = Date.now();

  // Calculate danger score
  let dangerScore = 0;
  if (extracted.debt.aprPercent) {
    if (extracted.debt.aprPercent >= 25) dangerScore += 40;
    else if (extracted.debt.aprPercent >= 18) dangerScore += 30;
    else if (extracted.debt.aprPercent >= 12) dangerScore += 20;
    else if (extracted.debt.aprPercent >= 6) dangerScore += 10;
  }
  const balanceDollars = extracted.debt.currentBalanceCents / 100;
  if (balanceDollars >= 50000) dangerScore += 40;
  else if (balanceDollars >= 20000) dangerScore += 30;
  else if (balanceDollars >= 10000) dangerScore += 20;
  else if (balanceDollars >= 5000) dangerScore += 10;

  await db.insert(debts).values({
    id,
    userId,
    name: extracted.debt.name,
    type: extracted.debt.type,
    originalBalanceCents: extracted.debt.currentBalanceCents,
    currentBalanceCents: extracted.debt.currentBalanceCents,
    aprPercent: extracted.debt.aprPercent ?? 0,
    minimumPaymentCents: extracted.debt.minimumPaymentCents,
    status: 'active',
    dangerScore: Math.min(100, dangerScore),
    createdAt: now,
    updatedAt: now,
  });

  const formattedAmount = (
    extracted.debt.currentBalanceCents / 100
  ).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  let message = `✅ Registrada: **${extracted.debt.name}** por **$${formattedAmount}**`;

  if (extracted.debt.aprPercent) {
    message += ` al ${extracted.debt.aprPercent}% de interés`;
  } else {
    message += `\n\n💡 Tip: Si me dices la tasa de interés, puedo calcular cuándo terminarás de pagarla y recomendarte la mejor estrategia.`;
  }

  if (dangerScore >= 60) {
    message += `\n\n⚠️ Esta deuda tiene un puntaje de riesgo alto (${dangerScore}/100). Te recomiendo priorizarla en tu plan de pago.`;
  }

  return {
    message,
    intent: 'debt_register',
    debtCreated: true,
    debtId: id,
    followUpActions: [
      {
        label: 'Ver mis deudas',
        type: 'quick_reply',
        value: '¿Cuánto debo en total?',
      },
      {
        label: 'Agregar otra deuda',
        type: 'quick_reply',
        value: 'Tengo otra deuda de $',
      },
    ],
  };
}

// ============================================================================
// DEBT INQUIRY HANDLER
// ============================================================================

/**
 * Show user their current debt situation
 */
async function handleDebtInquiry(userId: string): Promise<CopilotResponse> {
  const db = getDb();

  const userDebts = await db
    .select()
    .from(debts)
    .where(and(eq(debts.userId, userId), eq(debts.status, 'active')));

  if (userDebts.length === 0) {
    return {
      message: `🎉 ¡No tienes deudas registradas! Eso está genial.

Si tienes alguna deuda que quieras trackear, solo dime algo como:
"Tengo una deuda de tarjeta de $5000 al 18%"`,
      intent: 'debt_inquiry',
      followUpActions: [
        {
          label: 'Registrar deuda',
          type: 'quick_reply',
          value: 'Tengo una deuda de $',
        },
      ],
    };
  }

  const totalDebt = userDebts.reduce(
    (sum, d) => sum + d.currentBalanceCents,
    0
  );
  const totalMinPayment = userDebts.reduce(
    (sum, d) => sum + (d.minimumPaymentCents || 0),
    0
  );
  const highestApr = Math.max(...userDebts.map((d) => d.aprPercent));
  const mostDangerous = userDebts.reduce((max, d) =>
    (d.dangerScore ?? 0) > (max.dangerScore ?? 0) ? d : max
  );

  const formattedTotal = (totalDebt / 100).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  let message = `💳 **Resumen de tus deudas**\n\n`;
  message += `**Total:** $${formattedTotal}\n`;
  message += `**Deudas activas:** ${userDebts.length}\n`;

  if (totalMinPayment > 0) {
    const formattedMin = (totalMinPayment / 100).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    message += `**Pago mínimo mensual:** $${formattedMin}\n`;
  }

  message += `\n**Detalle:**\n`;
  for (const debt of userDebts.slice(0, 5)) {
    const amount = (debt.currentBalanceCents / 100).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    const danger = debt.dangerScore ? ` ⚠️${debt.dangerScore}` : '';
    message += `• ${debt.name}: $${amount} (${debt.aprPercent}% APR)${danger}\n`;
  }

  // Recommendations
  if (userDebts.length > 1 && highestApr > 15) {
    message += `\n💡 **Recomendación:** Usa el método avalancha - paga primero "${mostDangerous.name}" que tiene la mayor tasa de interés.`;
  } else if (totalDebt > 1000000) {
    message += `\n💡 **Recomendación:** Considera consolidar tus deudas para reducir la tasa de interés promedio.`;
  }

  return {
    message,
    intent: 'debt_inquiry',
    followUpActions: [
      {
        label: 'Estrategia de pago',
        type: 'quick_reply',
        value: '¿Cómo pago mis deudas más rápido?',
      },
      {
        label: 'Agregar deuda',
        type: 'quick_reply',
        value: 'Tengo otra deuda de $',
      },
    ],
  };
}

// ============================================================================
// SPENDING SUMMARY HANDLER
// ============================================================================

/**
 * Generate spending summary for the current month
 */
async function handleSpendingSummary(userId: string): Promise<CopilotResponse> {
  const db = getDb();

  // Get current month's transactions
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .split('T')[0]!;

  const monthTransactions = await db
    .select()
    .from(transactions)
    .where(
      and(eq(transactions.userId, userId), gte(transactions.date, startOfMonth))
    )
    .orderBy(desc(transactions.date));

  const expenses = monthTransactions.filter((t) => t.type === 'expense');
  const income = monthTransactions.filter((t) => t.type === 'income');

  const totalExpenses = expenses.reduce(
    (sum, t) => sum + Math.abs(t.amountCents),
    0
  );
  const totalIncome = income.reduce(
    (sum, t) => sum + Math.abs(t.amountCents),
    0
  );

  const formattedExpenses = (totalExpenses / 100).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const formattedIncome = (totalIncome / 100).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  // Get spending by category
  const categorySpending: Record<string, number> = {};
  for (const tx of expenses) {
    const catId = tx.categoryId || 'sin_categoria';
    categorySpending[catId] =
      (categorySpending[catId] || 0) + Math.abs(tx.amountCents);
  }

  // Get category names
  const userCategories = await db
    .select()
    .from(categories)
    .where(eq(categories.userId, userId));

  const categoryMap = new Map(userCategories.map((c) => [c.id, c]));

  // Sort categories by spending
  const topCategories = Object.entries(categorySpending)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  const monthNames = [
    'enero',
    'febrero',
    'marzo',
    'abril',
    'mayo',
    'junio',
    'julio',
    'agosto',
    'septiembre',
    'octubre',
    'noviembre',
    'diciembre',
  ];
  const currentMonth = monthNames[now.getMonth()];

  let message = `📊 **Resumen de ${currentMonth}**\n\n`;

  if (totalIncome > 0) {
    message += `💰 **Ingresos:** $${formattedIncome}\n`;
  }
  message += `💸 **Gastos:** $${formattedExpenses}\n`;

  const balance = totalIncome - totalExpenses;
  const formattedBalance = (Math.abs(balance) / 100).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  if (balance >= 0) {
    message += `✅ **Balance:** +$${formattedBalance}\n`;
  } else {
    message += `⚠️ **Balance:** -$${formattedBalance}\n`;
  }

  message += `📝 **Transacciones:** ${monthTransactions.length}\n`;

  if (topCategories.length > 0) {
    message += `\n**Top gastos por categoría:**\n`;
    for (const [catId, amount] of topCategories) {
      const cat = categoryMap.get(catId);
      const catName = cat
        ? `${cat.emoji || '📦'} ${cat.name}`
        : '📦 Sin categoría';
      const formattedAmount = (amount / 100).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
      message += `• ${catName}: $${formattedAmount}\n`;
    }
  }

  // Insights
  const insights: FinancialInsight[] = [];

  if (balance < 0) {
    insights.push({
      type: 'warning',
      message: `Estás gastando más de lo que ganas este mes. Revisa tus gastos en las categorías principales.`,
      priority: 'high',
    });
  } else if (totalIncome > 0 && totalExpenses / totalIncome > 0.9) {
    insights.push({
      type: 'warning',
      message: `Estás gastando el ${Math.round((totalExpenses / totalIncome) * 100)}% de tus ingresos. Intenta ahorrar al menos 10%.`,
      priority: 'medium',
    });
  } else if (totalIncome > 0 && totalExpenses / totalIncome < 0.7) {
    insights.push({
      type: 'achievement',
      message: `¡Excelente! Estás ahorrando más del 30% de tus ingresos. 💪`,
      priority: 'low',
    });
  }

  if (insights.length > 0) {
    message += `\n💡 ${insights[0]!.message}`;
  }

  return {
    message,
    intent: 'spending_summary',
    insights,
    followUpActions: [
      { label: 'Registrar gasto', type: 'quick_reply', value: 'Gasté $' },
      { label: 'Ver deudas', type: 'quick_reply', value: '¿Cuánto debo?' },
    ],
  };
}

// ============================================================================
// FINANCIAL INSIGHTS GENERATOR
// ============================================================================

/**
 * Generate proactive financial insights based on user's data
 */
async function generateFinancialInsights(
  userId: string
): Promise<FinancialInsight[]> {
  const db = getDb();
  const insights: FinancialInsight[] = [];

  try {
    // Check user profile for savings goals
    const [profile] = await db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.userId, userId));

    // Check debts
    const userDebts = await db
      .select()
      .from(debts)
      .where(and(eq(debts.userId, userId), eq(debts.status, 'active')));

    // High interest debt warning
    const highInterestDebt = userDebts.find((d) => d.aprPercent >= 20);
    if (highInterestDebt) {
      insights.push({
        type: 'warning',
        message: `Tu ${highInterestDebt.name} tiene ${highInterestDebt.aprPercent}% de interés. Prioriza pagarla lo antes posible.`,
        priority: 'high',
      });
    }

    // Check recent spending
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekAgoStr = weekAgo.toISOString().split('T')[0]!;

    const recentTx = await db
      .select()
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          gte(transactions.date, weekAgoStr),
          eq(transactions.type, 'expense')
        )
      );

    const weeklySpending = recentTx.reduce(
      (sum, t) => sum + Math.abs(t.amountCents),
      0
    );

    // Check against weekly limit if set
    if (
      profile?.weeklySpendingLimitCents &&
      weeklySpending > profile.weeklySpendingLimitCents
    ) {
      insights.push({
        type: 'warning',
        message: `Has excedido tu límite semanal de gastos. Llevas $${(weeklySpending / 100).toFixed(2)} de $${(profile.weeklySpendingLimitCents / 100).toFixed(2)}.`,
        priority: 'high',
      });
    }

    // General tips based on day of month
    const dayOfMonth = new Date().getDate();
    if (dayOfMonth <= 5 && !insights.some((i) => i.priority === 'high')) {
      insights.push({
        type: 'tip',
        message:
          'Inicio de mes = buen momento para revisar tu presupuesto y metas. ¿Ya definiste tus límites?',
        priority: 'low',
      });
    }
  } catch {
    // If we can't get insights, that's okay
  }

  return insights;
}
