/**
 * Transaction Copilot Service
 * Conversational AI agent for adding transactions through natural language
 */

import { nanoid } from 'nanoid';
import { eq, and } from 'drizzle-orm';
import { getDb } from '../db/client';
import { categories, transactions, accounts } from '../db/schema';

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
}

// Category mapping with emojis
const CATEGORY_CONFIG: Record<string, { patterns: string[]; emoji: string }> = {
  Compras: {
    patterns: ['ropa', 'zapatos', 'nike', 'zara', 'tienda', 'mall', 'amazon', 'compré', 'compras'],
    emoji: '🛍️',
  },
  Supermercado: {
    patterns: ['super', 'supermercado', 'mercado', 'walmart', 'costco', 'alimentos', 'groceries'],
    emoji: '🛒',
  },
  Restaurantes: {
    patterns: ['restaurante', 'almuerzo', 'cena', 'desayuno', 'pizza', 'sushi', 'hamburguesa', 'mcdonald', 'comí', 'comida'],
    emoji: '🍽️',
  },
  Café: {
    patterns: ['café', 'coffee', 'starbucks', 'cafetería', 'latte'],
    emoji: '☕',
  },
  Transporte: {
    patterns: ['uber', 'taxi', 'gasolina', 'gas', 'metro', 'bus', 'transporte', 'didi'],
    emoji: '🚗',
  },
  Entretenimiento: {
    patterns: ['cine', 'juegos', 'concierto', 'película', 'fiesta', 'bar', 'club'],
    emoji: '🎬',
  },
  Streaming: {
    patterns: ['netflix', 'spotify', 'disney', 'hbo', 'prime', 'youtube', 'streaming'],
    emoji: '📺',
  },
  Salud: {
    patterns: ['farmacia', 'medicina', 'doctor', 'hospital', 'dentista', 'médico'],
    emoji: '🏥',
  },
  Servicios: {
    patterns: ['luz', 'agua', 'internet', 'teléfono', 'electricidad', 'factura'],
    emoji: '💡',
  },
  Gimnasio: {
    patterns: ['gym', 'gimnasio', 'fitness', 'ejercicio', 'yoga', 'deporte'],
    emoji: '💪',
  },
  Salario: {
    patterns: ['salario', 'sueldo', 'quincena', 'pago', 'nómina', 'ingreso', 'trabajo'],
    emoji: '💰',
  },
  Freelance: {
    patterns: ['freelance', 'proyecto', 'cliente', 'trabajo extra', 'consultoría'],
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
function suggestCategoryFromText(text: string): { name: string; emoji: string } | null {
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

  // Extract amount
  const amountPatterns = [
    /\$\s*([\d,]+(?:\.\d{1,2})?)/,
    /([\d,]+(?:\.\d{1,2})?)\s*(?:dólares?|dolares?|pesos?|usd)/i,
    /gast[eéo]\s+\$?([\d,]+(?:\.\d{1,2})?)/i,
    /([\d,]+(?:\.\d{1,2})?)\s+(?:en|de)/i,
  ];

  let amountCents: number | null = null;
  for (const pattern of amountPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      amountCents = parseMoneyToCents(match[1]);
      break;
    }
  }

  // Extract date
  let date = new Date().toISOString().split('T')[0] ?? new Date().toISOString().slice(0, 10);
  if (lowerText.includes('ayer')) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    date = yesterday.toISOString().split('T')[0] ?? yesterday.toISOString().slice(0, 10);
  }

  // Determine income or expense
  const isIncome = /recib[íi]|cobr[eé]|gan[eé]|ingreso|salario|quincena|sueldo|me\s+pagar?on?/i.test(lowerText);
  const type = isIncome ? 'income' : 'expense';

  // Extract description
  let description = '';
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
    description = text.replace(/\$?\d+(?:[.,]\d{2})?/g, '').replace(/gast[eéo]/gi, '').trim() || 'Gasto';
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
 * Process a user message
 */
export async function processMessage(
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
    const [newAccount] = await db.select().from(accounts).where(eq(accounts.id, id));
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
      needsMoreInfo: true,
      missingFields: extracted.missingFields || [],
    };
  }

  if (extracted.understood && extracted.transaction) {
    const txData = extracted.transaction;

    // Find or create category
    let categoryId: string | null = null;
    let categoryName = txData.suggestedCategory;
    let categoryEmoji = txData.suggestedEmoji;

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
      amountCents: txData.type === 'expense' ? -Math.abs(txData.amountCents) : Math.abs(txData.amountCents),
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

    // Generate response
    const formattedAmount = (Math.abs(txData.amountCents) / 100).toFixed(2);
    const categoryText = categoryName ? ` en ${categoryEmoji || ''} ${categoryName}` : '';

    let message: string;
    if (txData.type === 'income') {
      const responses = [
        `¡Eso! Llegaron $${formattedAmount} 💰${categoryText}`,
        `Niceee! $${formattedAmount}${categoryText}`,
      ] as const;
      message = responses[Math.floor(Math.random() * responses.length)] ?? responses[0];
    } else {
      const amount = Math.abs(txData.amountCents) / 100;
      if (amount < 20) {
        message = `Listo! $${formattedAmount}${categoryText}`;
      } else if (amount < 100) {
        message = `Registrado! $${formattedAmount}${categoryText}. Cada peso cuenta 💪`;
      } else {
        const responses = [
          `Uff, $${formattedAmount}${categoryText} 💸`,
          `Bueno bueno, $${formattedAmount}${categoryText}. ¿Estaba en el presupuesto?`,
        ] as const;
        message = responses[Math.floor(Math.random() * responses.length)] ?? responses[0];
      }
    }

    return {
      message,
      transaction,
      transactionCreated: true,
      transactionId,
      suggestedCategories: userCategories
        .filter((c) => c.id !== categoryId)
        .slice(0, 5)
        .map((c) => ({ id: c.id, name: c.name, emoji: c.emoji })),
    };
  }

  return {
    message: '¿Puedes decirme el monto y en qué gastaste? 🤔',
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
    .where(and(eq(transactions.id, transactionId), eq(transactions.userId, userId)));

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
  ];
}
