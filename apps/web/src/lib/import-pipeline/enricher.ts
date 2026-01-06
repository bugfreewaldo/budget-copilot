/**
 * Transaction Enricher
 *
 * Enriches parsed transactions with:
 * - Category suggestions based on description patterns
 * - Transfer detection
 * - Statistics calculation
 */

import type { ParsedTransactionRow } from '../file-upload/types';
import type {
  EnrichedTransaction,
  ImportStats,
  EnrichmentResult,
} from './types';
import { detectTransfers, getMatchedTransferId } from './transfer-detector';
import { generateInsights } from './insights';

/**
 * Common category patterns for matching
 * Maps keywords to category names
 */
const CATEGORY_PATTERNS: Array<{
  keywords: string[];
  category: string;
  confidence: number;
}> = [
  // Transportation
  {
    keywords: ['uber', 'lyft', 'taxi', 'cabify'],
    category: 'Transporte',
    confidence: 0.9,
  },
  {
    keywords: ['gas', 'gasolina', 'shell', 'texaco', 'delta'],
    category: 'Gasolina',
    confidence: 0.85,
  },

  // Food & Dining
  {
    keywords: ['mcdonald', 'burger king', 'wendy', 'kfc', 'popeyes', 'subway'],
    category: 'Comida rápida',
    confidence: 0.9,
  },
  {
    keywords: ['starbucks', 'costa', 'coffee'],
    category: 'Café',
    confidence: 0.85,
  },
  {
    keywords: ['restaurant', 'restaurante', 'grill', 'sushi', 'pizza'],
    category: 'Restaurantes',
    confidence: 0.8,
  },
  {
    keywords: [
      'super 99',
      'riba smith',
      'rey',
      'pricesmart',
      'walmart',
      'costco',
    ],
    category: 'Supermercado',
    confidence: 0.9,
  },
  {
    keywords: ['uber eats', 'pedidosya', 'rappi', 'deliveroo'],
    category: 'Delivery',
    confidence: 0.9,
  },

  // Entertainment
  {
    keywords: [
      'netflix',
      'spotify',
      'disney',
      'hbo',
      'amazon prime',
      'youtube',
    ],
    category: 'Entretenimiento',
    confidence: 0.95,
  },
  {
    keywords: ['cine', 'movie', 'cinema', 'cinemark', 'cinepolis'],
    category: 'Cine',
    confidence: 0.9,
  },

  // Utilities & Services
  {
    keywords: ['internet', 'cable', 'starlink', 'tigo', 'claro', 'movistar'],
    category: 'Internet',
    confidence: 0.9,
  },
  {
    keywords: ['electric', 'luz', 'naturgy', 'ensa', 'energia'],
    category: 'Electricidad',
    confidence: 0.85,
  },
  { keywords: ['water', 'agua', 'idaan'], category: 'Agua', confidence: 0.85 },
  {
    keywords: ['phone', 'telefono', 'movil', 'celular'],
    category: 'Teléfono',
    confidence: 0.8,
  },

  // Health
  {
    keywords: ['farmacia', 'arrocha', 'metro plus', 'pharmacy', 'cvs'],
    category: 'Farmacia',
    confidence: 0.9,
  },
  {
    keywords: ['hospital', 'clinica', 'doctor', 'medico', 'salud'],
    category: 'Salud',
    confidence: 0.8,
  },
  {
    keywords: ['gym', 'gimnasio', 'fitness', 'crossfit'],
    category: 'Gimnasio',
    confidence: 0.9,
  },

  // Shopping
  {
    keywords: ['amazon', 'ebay', 'mercadolibre'],
    category: 'Compras online',
    confidence: 0.85,
  },
  {
    keywords: ['zara', 'h&m', 'nike', 'adidas', 'clothing'],
    category: 'Ropa',
    confidence: 0.8,
  },

  // Financial
  {
    keywords: ['atm', 'cajero', 'withdrawal', 'retiro'],
    category: 'Retiro efectivo',
    confidence: 0.9,
  },
  {
    keywords: ['fee', 'comision', 'cargo', 'maintenance'],
    category: 'Comisiones',
    confidence: 0.8,
  },
  {
    keywords: ['seguro', 'insurance', 'aseguradora'],
    category: 'Seguros',
    confidence: 0.85,
  },

  // Travel
  {
    keywords: [
      'copa airlines',
      'avianca',
      'american airlines',
      'delta',
      'flight',
    ],
    category: 'Vuelos',
    confidence: 0.9,
  },
  {
    keywords: ['hotel', 'airbnb', 'booking', 'marriott', 'hilton'],
    category: 'Hospedaje',
    confidence: 0.9,
  },

  // Income
  {
    keywords: ['salary', 'salario', 'nomina', 'payroll', 'deposit'],
    category: 'Salario',
    confidence: 0.7,
  },
  {
    keywords: ['interest', 'interes', 'dividend'],
    category: 'Intereses',
    confidence: 0.8,
  },
  {
    keywords: ['refund', 'reembolso', 'devolucion'],
    category: 'Reembolsos',
    confidence: 0.85,
  },
];

/**
 * Match a transaction description against category patterns
 */
function matchCategory(
  description: string,
  existingGuess: string | null | undefined
): {
  name: string | null;
  confidence: number;
  source: 'pattern' | 'ai' | 'none';
} {
  const normalizedDesc = description.toLowerCase().trim();

  // First, try pattern matching
  for (const pattern of CATEGORY_PATTERNS) {
    for (const keyword of pattern.keywords) {
      if (normalizedDesc.includes(keyword.toLowerCase())) {
        return {
          name: pattern.category,
          confidence: pattern.confidence,
          source: 'pattern',
        };
      }
    }
  }

  // If we have an existing guess from AI parsing, use it with medium confidence
  if (existingGuess) {
    return {
      name: existingGuess,
      confidence: 0.6,
      source: 'ai',
    };
  }

  // No match found
  return {
    name: null,
    confidence: 0,
    source: 'none',
  };
}

/**
 * Calculate import statistics
 */
function calculateStats(
  transactions: EnrichedTransaction[],
  transferCount: number
): ImportStats {
  let incomeCount = 0;
  let expenseCount = 0;
  let uncategorizedCount = 0;
  let lowConfidenceCount = 0;
  let microFeeCount = 0;
  let totalIncomeCents = 0;
  let totalExpenseCents = 0;
  let minAmount = Infinity;
  let maxAmount = 0;
  let minDate: string | null = null;
  let maxDate: string | null = null;

  for (const tx of transactions) {
    const absAmount = Math.abs(tx.amount);
    const amountCents = Math.round(absAmount * 100);

    if (tx.isCredit) {
      incomeCount++;
      totalIncomeCents += amountCents;
    } else {
      expenseCount++;
      totalExpenseCents += amountCents;
    }

    if (tx.category.id === null && tx.category.name === null) {
      uncategorizedCount++;
    }

    if (tx.category.confidence < 0.7 && tx.category.confidence > 0) {
      lowConfidenceCount++;
    }

    if (absAmount < 1) {
      microFeeCount++;
    }

    if (absAmount < minAmount) minAmount = absAmount;
    if (absAmount > maxAmount) maxAmount = absAmount;

    if (tx.date) {
      if (!minDate || tx.date < minDate) minDate = tx.date;
      if (!maxDate || tx.date > maxDate) maxDate = tx.date;
    }
  }

  return {
    totalCount: transactions.length,
    incomeCount,
    expenseCount,
    transferCount,
    uncategorizedCount,
    lowConfidenceCount,
    microFeeCount,
    dateRange: {
      from: minDate,
      to: maxDate,
    },
    amountRange: {
      min: minAmount === Infinity ? 0 : minAmount,
      max: maxAmount,
    },
    totalIncomeCents,
    totalExpenseCents,
  };
}

/**
 * Enrich parsed transactions with categories, transfer detection, and stats
 */
export function enrichTransactions(
  transactions: ParsedTransactionRow[]
): EnrichmentResult {
  // Detect transfers first
  const transferPairs = detectTransfers(transactions);
  const transferIds = new Set<string>();
  for (const pair of transferPairs) {
    transferIds.add(pair.creditId);
    transferIds.add(pair.debitId);
  }

  // Enrich each transaction
  const enriched: EnrichedTransaction[] = transactions.map((tx) => {
    const isTransfer = transferIds.has(tx.id);
    const matchedTransferId = isTransfer
      ? getMatchedTransferId(tx.id, transferPairs)
      : undefined;

    const category = matchCategory(tx.description, tx.categoryGuess);

    return {
      id: tx.id,
      date: tx.date,
      description: tx.description,
      amount: tx.amount,
      isCredit: tx.isCredit,
      category: {
        id: null, // We don't have actual category IDs, just names
        name: category.name,
        confidence: category.confidence,
        source: category.source,
      },
      isTransfer,
      matchedTransferId,
    };
  });

  // Calculate stats
  const stats = calculateStats(enriched, transferPairs.length);

  // Generate insights
  const insights = generateInsights(enriched, stats);

  return {
    transactions: enriched,
    transferPairs,
    stats,
    insights,
  };
}

/**
 * Re-enrich a single transaction (for when user changes category)
 */
export function updateTransactionCategory(
  transaction: EnrichedTransaction,
  categoryId: string | null,
  categoryName: string | null
): EnrichedTransaction {
  return {
    ...transaction,
    category: {
      id: categoryId,
      name: categoryName,
      confidence: 1.0, // User-assigned = full confidence
      source: categoryId ? 'pattern' : 'none', // Mark as pattern if assigned
    },
  };
}
