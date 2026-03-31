import { NextRequest, NextResponse } from 'next/server';
import { eq, and, isNull } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { transactions, categories, categoryPatterns } from '@/lib/db/schema';
import { getAuthenticatedUser } from '@/lib/api/auth';
import { errorJson } from '@/lib/api/utils';
import { categorizeBatchWithLLM } from '@/lib/import-pipeline/llm-categorizer';
import { normalizeDescription } from '@/lib/import-pipeline/pattern-learner';

export const dynamic = 'force-dynamic';

// Hardcoded patterns (same as enricher, kept lean for this endpoint)
const KEYWORD_PATTERNS: Array<{ keywords: string[]; category: string }> = [
  { keywords: ['uber', 'lyft', 'taxi', 'cabify'], category: 'Taxi/Rideshare' },
  { keywords: ['gas', 'gasolina', 'shell', 'texaco'], category: 'Gas' },
  {
    keywords: ['mcdonald', 'burger king', 'wendy', 'kfc', 'subway'],
    category: 'Fast Food',
  },
  { keywords: ['starbucks', 'coffee'], category: 'Coffee/Snacks' },
  {
    keywords: ['restaurant', 'restaurante', 'grill', 'sushi', 'pizza'],
    category: 'Restaurants',
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
  },
  {
    keywords: ['uber eats', 'pedidosya', 'rappi'],
    category: 'Delivery/Takeout',
  },
  {
    keywords: [
      'netflix',
      'spotify',
      'disney',
      'hbo',
      'amazon prime',
      'youtube',
    ],
    category: 'Streaming (Netflix, etc.)',
  },
  {
    keywords: ['internet', 'cable', 'starlink', 'tigo', 'claro'],
    category: 'Internet/Cable',
  },
  {
    keywords: ['electric', 'luz', 'naturgy', 'ensa'],
    category: 'Utilities (Water/Electric/Gas)',
  },
  {
    keywords: ['farmacia', 'arrocha', 'pharmacy', 'cvs'],
    category: 'Medications',
  },
  {
    keywords: ['hospital', 'clinica', 'doctor', 'medico'],
    category: 'Doctor Visits',
  },
  { keywords: ['gym', 'gimnasio', 'fitness'], category: 'Gym/Fitness' },
  { keywords: ['amazon', 'ebay'], category: 'Electronics' },
  { keywords: ['zara', 'h&m', 'nike', 'adidas'], category: 'Clothing' },
  {
    keywords: ['atm', 'cajero', 'withdrawal', 'retiro'],
    category: 'Transfers',
  },
  { keywords: ['seguro', 'insurance'], category: 'Insurance' },
  { keywords: ['hotel', 'airbnb', 'booking'], category: 'Hotels/Lodging' },
  { keywords: ['salary', 'salario', 'nomina', 'payroll'], category: 'Salary' },
  { keywords: ['refund', 'reembolso', 'devolucion'], category: 'Refunds' },
  { keywords: ['yappy'], category: 'Transfers' },
  { keywords: ['banca movil', 'banca móvil'], category: 'Transfers' },
  { keywords: ['entre cuentas', 'entre cuent'], category: 'Transfers' },
  {
    keywords: ['nequi', 'zelle', 'transfer', 'transferencia'],
    category: 'Transfers',
  },
];

/**
 * POST /api/v1/transactions/auto-categorize
 * Auto-categorize uncategorized transactions using learned patterns + LLM
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(request);
    if (!auth.success) return auth.response;

    const db = getDb();
    const userId = auth.user.id;

    // 1. Get uncategorized transactions
    const uncategorized = await db
      .select()
      .from(transactions)
      .where(
        and(eq(transactions.userId, userId), isNull(transactions.categoryId))
      );

    if (uncategorized.length === 0) {
      return NextResponse.json({
        data: {
          categorized: 0,
          total: 0,
          message: 'All transactions are already categorized.',
        },
      });
    }

    // 2. Load user categories
    const userCategories = await db
      .select()
      .from(categories)
      .where(eq(categories.userId, userId));

    // Build name -> category lookup (case insensitive)
    const catByName = new Map<string, (typeof userCategories)[number]>();
    for (const c of userCategories) {
      catByName.set(c.name.toLowerCase(), c);
    }

    // 3. Load learned patterns
    const learnedPatterns = await db
      .select()
      .from(categoryPatterns)
      .where(eq(categoryPatterns.userId, userId));

    const learnedKeywords = new Map<string, string>();
    const learnedMerchants = new Map<string, string>();
    for (const p of learnedPatterns) {
      if (!userCategories.some((c) => c.id === p.categoryId)) continue;
      if (p.patternType === 'keyword')
        learnedKeywords.set(p.patternValue, p.categoryId);
      else if (p.patternType === 'merchant')
        learnedMerchants.set(p.patternValue, p.categoryId);
    }

    // 4. Match: learned patterns -> hardcoded patterns
    const matched: Array<{ txId: string; categoryId: string }> = [];
    const stillUnmatched: typeof uncategorized = [];

    for (const tx of uncategorized) {
      const normalized = normalizeDescription(tx.description);
      let foundCategoryId: string | null = null;

      // Learned exact match
      if (learnedKeywords.has(normalized)) {
        foundCategoryId = learnedKeywords.get(normalized)!;
      }

      // Learned merchant match
      if (!foundCategoryId) {
        for (const [merchant, catId] of learnedMerchants) {
          if (normalized.includes(merchant)) {
            foundCategoryId = catId;
            break;
          }
        }
      }

      // Hardcoded pattern match
      if (!foundCategoryId) {
        const descLower = tx.description.toLowerCase();
        for (const pattern of KEYWORD_PATTERNS) {
          for (const keyword of pattern.keywords) {
            if (descLower.includes(keyword)) {
              // Resolve name to user's category
              const resolved = catByName.get(pattern.category.toLowerCase());
              if (resolved) foundCategoryId = resolved.id;
              // Try partial match
              if (!foundCategoryId) {
                for (const [name, cat] of catByName) {
                  if (
                    name.includes(pattern.category.toLowerCase()) ||
                    pattern.category.toLowerCase().includes(name)
                  ) {
                    foundCategoryId = cat.id;
                    break;
                  }
                }
              }
              if (foundCategoryId) break;
            }
          }
          if (foundCategoryId) break;
        }
      }

      if (foundCategoryId) {
        matched.push({ txId: tx.id, categoryId: foundCategoryId });
      } else {
        stillUnmatched.push(tx);
      }
    }

    // 5. LLM fallback for remaining uncategorized
    if (stillUnmatched.length > 0) {
      try {
        const categoryOptions = userCategories.map((c) => {
          const parent = c.parentId
            ? userCategories.find((p) => p.id === c.parentId)
            : null;
          return {
            id: c.id,
            name: c.name,
            emoji: c.emoji,
            parentName: parent?.name ?? null,
          };
        });

        const learnedExamples = Array.from(learnedKeywords.entries())
          .slice(0, 20)
          .map(([desc, catId]) => ({
            description: desc,
            categoryName:
              userCategories.find((c) => c.id === catId)?.name ?? 'Unknown',
          }));

        const llmResults = await categorizeBatchWithLLM(
          stillUnmatched.map((tx) => ({
            id: tx.id,
            description: tx.description,
            amount: tx.amountCents / 100,
            isCredit: tx.type === 'income',
            date: tx.date,
          })),
          categoryOptions,
          learnedExamples
        );

        for (const result of llmResults) {
          if (result.categoryId) {
            matched.push({
              txId: result.transactionId,
              categoryId: result.categoryId,
            });
          }
        }
      } catch (err) {
        console.error('[auto-categorize] LLM failed:', err);
      }
    }

    // 6. Apply all matches to DB
    const now = Date.now();
    for (const { txId, categoryId } of matched) {
      await db
        .update(transactions)
        .set({ categoryId, updatedAt: now })
        .where(and(eq(transactions.id, txId), eq(transactions.userId, userId)));
    }

    return NextResponse.json({
      data: {
        categorized: matched.length,
        total: uncategorized.length,
        remaining: uncategorized.length - matched.length,
        message:
          matched.length === uncategorized.length
            ? `All ${matched.length} transactions categorized.`
            : `Categorized ${matched.length} of ${uncategorized.length} transactions. ${uncategorized.length - matched.length} need manual review.`,
      },
    });
  } catch (error) {
    console.error('Auto-categorize failed:', error);
    return errorJson('INTERNAL_ERROR', 'Failed to auto-categorize', 500);
  }
}
