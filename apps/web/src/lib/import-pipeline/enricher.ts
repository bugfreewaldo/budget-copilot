/**
 * Transaction Enricher
 *
 * Enriches parsed transactions with:
 * - Category suggestions based on description patterns
 * - Transfer detection
 * - Statistics calculation
 */

import { eq, desc } from 'drizzle-orm';
import type { ParsedTransactionRow } from '../file-upload/types';
import type {
  EnrichedTransaction,
  ImportStats,
  EnrichmentResult,
} from './types';
import { detectTransfers, getMatchedTransferId } from './transfer-detector';
import { generateInsights } from './insights';
import { categorizeBatchWithLLM } from './llm-categorizer';
import { normalizeDescription } from './pattern-learner';

interface CategoryInfo {
  id: string;
  name: string;
  parentId: string | null;
  emoji?: string | null;
}

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
    category: 'Transportation',
    confidence: 0.9,
  },
  {
    keywords: ['gas', 'gasolina', 'shell', 'texaco', 'delta'],
    category: 'Gas',
    confidence: 0.85,
  },

  // Food & Dining
  {
    keywords: ['mcdonald', 'burger king', 'wendy', 'kfc', 'popeyes', 'subway'],
    category: 'Fast Food',
    confidence: 0.9,
  },
  {
    keywords: ['starbucks', 'costa', 'coffee'],
    category: 'Coffee',
    confidence: 0.85,
  },
  {
    keywords: ['restaurant', 'restaurante', 'grill', 'sushi', 'pizza'],
    category: 'Restaurants',
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
    category: 'Groceries',
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
    category: 'Entertainment',
    confidence: 0.95,
  },
  {
    keywords: ['cine', 'movie', 'cinema', 'cinemark', 'cinepolis'],
    category: 'Movies',
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
    category: 'Electricity',
    confidence: 0.85,
  },
  { keywords: ['water', 'agua', 'idaan'], category: 'Water', confidence: 0.85 },
  {
    keywords: ['phone', 'telefono', 'movil', 'celular'],
    category: 'Phone',
    confidence: 0.8,
  },

  // Health
  {
    keywords: ['farmacia', 'arrocha', 'metro plus', 'pharmacy', 'cvs'],
    category: 'Pharmacy',
    confidence: 0.9,
  },
  {
    keywords: ['hospital', 'clinica', 'doctor', 'medico', 'salud'],
    category: 'Health',
    confidence: 0.8,
  },
  {
    keywords: ['gym', 'gimnasio', 'fitness', 'crossfit'],
    category: 'Gym',
    confidence: 0.9,
  },

  // Shopping
  {
    keywords: ['amazon', 'ebay', 'mercadolibre'],
    category: 'Online Shopping',
    confidence: 0.85,
  },
  {
    keywords: ['zara', 'h&m', 'nike', 'adidas', 'clothing'],
    category: 'Clothing',
    confidence: 0.8,
  },

  // Financial
  {
    keywords: ['atm', 'cajero', 'withdrawal', 'retiro'],
    category: 'Cash Withdrawal',
    confidence: 0.9,
  },
  {
    keywords: ['fee', 'comision', 'cargo', 'maintenance'],
    category: 'Fees',
    confidence: 0.8,
  },
  {
    keywords: ['seguro', 'insurance', 'aseguradora'],
    category: 'Insurance',
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
    category: 'Flights',
    confidence: 0.9,
  },
  {
    keywords: ['hotel', 'airbnb', 'booking', 'marriott', 'hilton'],
    category: 'Lodging',
    confidence: 0.9,
  },

  // Income
  {
    keywords: ['salary', 'salario', 'nomina', 'payroll', 'deposit'],
    category: 'Salary',
    confidence: 0.7,
  },
  {
    keywords: ['interest', 'interes', 'dividend'],
    category: 'Interest',
    confidence: 0.8,
  },
  {
    keywords: ['refund', 'reembolso', 'devolucion'],
    category: 'Refunds',
    confidence: 0.85,
  },
  {
    keywords: [
      'yappy',
      'banca movil',
      'banca móvil',
      'entre cuentas',
      'entre cuent',
      'nequi',
      'zelle',
      'transferencia',
    ],
    category: 'Transfers',
    confidence: 0.85,
  },
];

/**
 * Build a lookup map from category name (lowercase) to category info.
 * Checks both exact name and common aliases.
 */
function buildCategoryLookup(
  categories: CategoryInfo[]
): Map<string, CategoryInfo> {
  const lookup = new Map<string, CategoryInfo>();
  for (const cat of categories) {
    lookup.set(cat.name.toLowerCase(), cat);
  }
  return lookup;
}

/**
 * Resolve a matched category name to an actual user category ID.
 * Tries exact match first, then partial match.
 */
function resolveCategoryId(
  categoryName: string,
  lookup: Map<string, CategoryInfo>
): { id: string; name: string } | null {
  // Exact match
  const exact = lookup.get(categoryName.toLowerCase());
  if (exact) return { id: exact.id, name: exact.name };

  // Partial match: find a category whose name contains the pattern name or vice versa
  const lowerName = categoryName.toLowerCase();
  for (const [key, cat] of lookup) {
    if (key.includes(lowerName) || lowerName.includes(key)) {
      return { id: cat.id, name: cat.name };
    }
  }

  return null;
}

/**
 * Match a transaction description against category patterns
 */
function matchCategory(
  description: string,
  existingGuess: string | null | undefined,
  categoryLookup?: Map<string, CategoryInfo>
): {
  id: string | null;
  name: string | null;
  confidence: number;
  source: 'pattern' | 'ai' | 'none';
} {
  const normalizedDesc = description.toLowerCase().trim();

  // First, try pattern matching
  for (const pattern of CATEGORY_PATTERNS) {
    for (const keyword of pattern.keywords) {
      if (normalizedDesc.includes(keyword.toLowerCase())) {
        const resolved = categoryLookup
          ? resolveCategoryId(pattern.category, categoryLookup)
          : null;
        return {
          id: resolved?.id ?? null,
          name: resolved?.name ?? pattern.category,
          confidence: pattern.confidence,
          source: 'pattern',
        };
      }
    }
  }

  // If we have an existing guess from AI parsing, try to resolve it
  if (existingGuess) {
    const resolved = categoryLookup
      ? resolveCategoryId(existingGuess, categoryLookup)
      : null;
    return {
      id: resolved?.id ?? null,
      name: resolved?.name ?? existingGuess,
      confidence: 0.6,
      source: 'ai',
    };
  }

  // No match found
  return {
    id: null,
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
 * @param categories - Optional user categories for resolving IDs during auto-assign
 */
export function enrichTransactions(
  transactions: ParsedTransactionRow[],
  categories?: CategoryInfo[]
): EnrichmentResult {
  // Build category lookup for auto-assignment
  const categoryLookup = categories
    ? buildCategoryLookup(categories)
    : undefined;

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

    const category = matchCategory(
      tx.description,
      tx.categoryGuess,
      categoryLookup
    );

    return {
      id: tx.id,
      date: tx.date,
      description: tx.description,
      amount: tx.amount,
      isCredit: tx.isCredit,
      category: {
        id: category.id,
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

// ============================================================================
// ASYNC ENRICHER WITH LEARNING + LLM FALLBACK
// ============================================================================

interface LearnedPattern {
  categoryId: string;
  patternValue: string;
  patternType: string;
  confidence: number;
  matchCount: number;
}

/**
 * Enrich transactions with learned patterns (from DB) and LLM fallback.
 * Priority: learned patterns > hardcoded patterns > LLM > parser AI guess
 *
 * @param transactions - Parsed transactions from bank statement
 * @param categories - User's categories with full info
 * @param userId - User ID for querying learned patterns
 */
export async function enrichTransactionsWithLearning(
  transactions: ParsedTransactionRow[],
  categories: CategoryInfo[],
  userId: string
): Promise<EnrichmentResult> {
  // 1. Load learned patterns from DB
  let learnedPatterns: LearnedPattern[] = [];
  try {
    const { getDb } = await import('@/lib/db/client');
    const { categoryPatterns } = await import('@/lib/db/schema');
    const db = getDb();

    learnedPatterns = await db
      .select({
        categoryId: categoryPatterns.categoryId,
        patternValue: categoryPatterns.patternValue,
        patternType: categoryPatterns.patternType,
        confidence: categoryPatterns.confidence,
        matchCount: categoryPatterns.matchCount,
      })
      .from(categoryPatterns)
      .where(eq(categoryPatterns.userId, userId))
      .orderBy(desc(categoryPatterns.confidence));
  } catch (err) {
    console.error('[enricher] Failed to load learned patterns:', err);
  }

  // Build lookups
  const categoryLookup = buildCategoryLookup(categories);
  const categoryById = new Map(categories.map((c) => [c.id, c]));

  // Build learned pattern index: normalized description -> { categoryId, confidence }
  const learnedKeywords = new Map<
    string,
    { categoryId: string; confidence: number }
  >();
  const learnedMerchants = new Map<
    string,
    { categoryId: string; confidence: number }
  >();

  for (const p of learnedPatterns) {
    // Only use patterns whose category still exists
    if (!categoryById.has(p.categoryId)) continue;

    if (p.patternType === 'keyword') {
      learnedKeywords.set(p.patternValue, {
        categoryId: p.categoryId,
        confidence: p.confidence,
      });
    } else if (p.patternType === 'merchant') {
      learnedMerchants.set(p.patternValue, {
        categoryId: p.categoryId,
        confidence: p.confidence,
      });
    }
  }

  // 2. Detect transfers
  const transferPairs = detectTransfers(transactions);
  const transferIds = new Set<string>();
  for (const pair of transferPairs) {
    transferIds.add(pair.creditId);
    transferIds.add(pair.debitId);
  }

  // 3. Enrich each transaction with learned patterns first
  const enriched: EnrichedTransaction[] = transactions.map((tx) => {
    const isTransfer = transferIds.has(tx.id);
    const matchedTransferId = isTransfer
      ? getMatchedTransferId(tx.id, transferPairs)
      : undefined;

    const normalized = normalizeDescription(tx.description);

    // Priority 1: Exact learned keyword match
    const learnedMatch = learnedKeywords.get(normalized);
    if (learnedMatch) {
      const cat = categoryById.get(learnedMatch.categoryId);
      return {
        id: tx.id,
        date: tx.date,
        description: tx.description,
        amount: tx.amount,
        isCredit: tx.isCredit,
        category: {
          id: learnedMatch.categoryId,
          name: cat?.name ?? null,
          confidence: learnedMatch.confidence,
          source: 'learned' as const,
        },
        isTransfer,
        matchedTransferId,
      };
    }

    // Priority 2: Learned merchant match (substring)
    for (const [merchant, match] of learnedMerchants) {
      if (normalized.includes(merchant)) {
        const cat = categoryById.get(match.categoryId);
        return {
          id: tx.id,
          date: tx.date,
          description: tx.description,
          amount: tx.amount,
          isCredit: tx.isCredit,
          category: {
            id: match.categoryId,
            name: cat?.name ?? null,
            confidence: match.confidence * 0.9, // Slightly less confident for merchant-level
            source: 'learned' as const,
          },
          isTransfer,
          matchedTransferId,
        };
      }
    }

    // Priority 3: Hardcoded pattern match
    const hardcoded = matchCategory(
      tx.description,
      tx.categoryGuess,
      categoryLookup
    );
    if (hardcoded.id) {
      return {
        id: tx.id,
        date: tx.date,
        description: tx.description,
        amount: tx.amount,
        isCredit: tx.isCredit,
        category: {
          id: hardcoded.id,
          name: hardcoded.name,
          confidence: hardcoded.confidence * 0.8, // Reduce hardcoded confidence
          source: 'pattern' as const,
        },
        isTransfer,
        matchedTransferId,
      };
    }

    // Priority 4: AI parser guess (resolved to ID if possible)
    if (hardcoded.name) {
      return {
        id: tx.id,
        date: tx.date,
        description: tx.description,
        amount: tx.amount,
        isCredit: tx.isCredit,
        category: {
          id: null,
          name: hardcoded.name,
          confidence: 0.5,
          source: 'ai' as const,
        },
        isTransfer,
        matchedTransferId,
      };
    }

    // No match at all
    return {
      id: tx.id,
      date: tx.date,
      description: tx.description,
      amount: tx.amount,
      isCredit: tx.isCredit,
      category: {
        id: null,
        name: null,
        confidence: 0,
        source: 'none' as const,
      },
      isTransfer,
      matchedTransferId,
    };
  });

  // 4. LLM fallback for uncategorized transactions
  const uncategorized = enriched.filter(
    (tx) => tx.category.id === null && !tx.isTransfer
  );

  if (uncategorized.length > 0) {
    try {
      // Build category options with parent names
      const categoryOptions = categories.map((c) => {
        const parent = c.parentId ? categoryById.get(c.parentId) : null;
        return {
          id: c.id,
          name: c.name,
          emoji: c.emoji ?? null,
          parentName: parent?.name ?? null,
        };
      });

      // Build learned examples for context
      const learnedExamples = Array.from(learnedKeywords.entries())
        .slice(0, 20)
        .map(([desc, match]) => ({
          description: desc,
          categoryName: categoryById.get(match.categoryId)?.name ?? 'Unknown',
        }));

      const llmResults = await categorizeBatchWithLLM(
        uncategorized.map((tx) => ({
          id: tx.id,
          description: tx.description,
          amount: tx.amount,
          isCredit: tx.isCredit,
          date: tx.date,
        })),
        categoryOptions,
        learnedExamples
      );

      // Merge LLM results back
      const llmMap = new Map(llmResults.map((r) => [r.transactionId, r]));
      for (const tx of enriched) {
        const llmResult = llmMap.get(tx.id);
        if (llmResult && llmResult.categoryId) {
          tx.category = {
            id: llmResult.categoryId,
            name: llmResult.categoryName,
            confidence: llmResult.confidence,
            source: 'llm',
          };
        }
      }
    } catch (err) {
      console.error('[enricher] LLM categorization failed:', err);
      // Non-fatal: continue with partial categorization
    }
  }

  // 5. Calculate stats and insights
  const stats = calculateStats(enriched, transferPairs.length);
  const insights = generateInsights(enriched, stats);

  return { transactions: enriched, transferPairs, stats, insights };
}
