/**
 * Auto-Categorization Service
 *
 * Automatically categorizes transactions when created via API/form
 * without a category specified.
 *
 * Categorization priority:
 * 1. Learned patterns from categoryPatterns table
 * 2. AI analysis of the description
 * 3. Leave uncategorized if no confident match
 */

import { nanoid } from 'nanoid';
import { getDb } from '../../db/client.js';
import { categoryPatterns, categories } from '../../db/schema.js';
import { eq, desc, and } from 'drizzle-orm';
import { getProvider } from '@budget-copilot/ai';
import type { Message } from '@budget-copilot/ai';

interface CategorySuggestion {
  categoryId: string;
  categoryName: string;
  emoji: string | null;
  confidence: number;
  source: 'pattern' | 'ai';
}

// Minimum confidence threshold for auto-categorization
const MIN_CONFIDENCE = 0.5;

/**
 * Suggest category based on learned patterns
 */
async function suggestFromPatterns(
  userId: string,
  description: string,
  amountCents: number
): Promise<CategorySuggestion | null> {
  const db = await getDb();

  // Get patterns for this user's categories
  const userCategories = await db
    .select()
    .from(categories)
    .where(eq(categories.userId, userId));

  const categoryIds = userCategories.map((c) => c.id);

  if (categoryIds.length === 0) {
    return null;
  }

  // Get all patterns ordered by confidence
  const patterns = await db.query.categoryPatterns.findMany({
    orderBy: [desc(categoryPatterns.confidence)],
  });

  // Filter to patterns for this user's categories
  const userPatterns = patterns.filter((p) =>
    categoryIds.includes(p.categoryId)
  );

  const descLower = description.toLowerCase();

  for (const pattern of userPatterns) {
    let matched = false;

    switch (pattern.patternType) {
      case 'keyword':
        if (descLower.includes(pattern.patternValue.toLowerCase())) {
          matched = true;
        }
        break;

      case 'merchant':
        if (descLower.includes(pattern.patternValue.toLowerCase())) {
          matched = true;
        }
        break;

      case 'description_regex':
        try {
          const regex = new RegExp(pattern.patternValue, 'i');
          if (regex.test(description)) {
            matched = true;
          }
        } catch {
          // Invalid regex, skip
        }
        break;

      case 'amount_range':
        try {
          const [min, max] = pattern.patternValue.split('-').map(Number);
          const absAmount = Math.abs(amountCents);
          if (absAmount >= min && absAmount <= max) {
            matched = true;
          }
        } catch {
          // Invalid range format, skip
        }
        break;
    }

    if (matched && pattern.confidence >= MIN_CONFIDENCE) {
      // Find the category
      const category = userCategories.find((c) => c.id === pattern.categoryId);
      if (category) {
        return {
          categoryId: pattern.categoryId,
          categoryName: category.name,
          emoji: category.emoji,
          confidence: pattern.confidence,
          source: 'pattern',
        };
      }
    }
  }

  return null;
}

/**
 * Suggest category using AI analysis
 */
async function suggestFromAI(
  userId: string,
  description: string,
  transactionType: 'income' | 'expense'
): Promise<CategorySuggestion | null> {
  const db = await getDb();

  // Get user's categories
  const userCategories = await db
    .select()
    .from(categories)
    .where(eq(categories.userId, userId));

  if (userCategories.length === 0) {
    return null;
  }

  const provider = getProvider();
  if (!provider.isConfigured()) {
    return null;
  }

  // Build category list for AI
  const categoryList = userCategories
    .map((c) => `- ${c.emoji || ''} ${c.name} (id: ${c.id})`)
    .join('\n');

  const prompt = `Analiza esta transacción y sugiere la categoría más apropiada.

Tipo: ${transactionType === 'income' ? 'Ingreso' : 'Gasto'}
Descripción: "${description}"

Categorías disponibles:
${categoryList}

Responde SOLO con un JSON válido en este formato:
{
  "categoryId": "el id de la categoría más apropiada o null si ninguna aplica",
  "confidence": número entre 0.0 y 1.0 indicando tu confianza,
  "reasoning": "breve explicación"
}

Si la descripción es muy ambigua o no hay categoría apropiada, responde con categoryId: null.`;

  try {
    const messages: Message[] = [
      {
        role: 'system',
        content:
          'Eres un asistente de categorización de finanzas personales. Analiza descripciones de transacciones y sugiere categorías. Sé conservador - solo sugiere si tienes confianza alta.',
      },
      { role: 'user', content: prompt },
    ];

    const result = await provider.chat(messages, {
      temperature: 0.1,
      maxTokens: 200,
    });

    // Parse AI response
    let jsonStr = result.message.content.trim();

    // Remove markdown code blocks if present
    if (jsonStr.startsWith('```')) {
      const firstNewline = jsonStr.indexOf('\n');
      if (firstNewline !== -1) {
        jsonStr = jsonStr.substring(firstNewline + 1);
      }
      if (jsonStr.endsWith('```')) {
        jsonStr = jsonStr.substring(0, jsonStr.length - 3).trim();
      }
    }

    const aiResponse = JSON.parse(jsonStr) as {
      categoryId: string | null;
      confidence: number;
      reasoning?: string;
    };

    if (!aiResponse.categoryId || aiResponse.confidence < MIN_CONFIDENCE) {
      return null;
    }

    // Verify the category exists and belongs to user
    const category = userCategories.find((c) => c.id === aiResponse.categoryId);
    if (!category) {
      return null;
    }

    return {
      categoryId: category.id,
      categoryName: category.name,
      emoji: category.emoji,
      confidence: aiResponse.confidence,
      source: 'ai',
    };
  } catch (error) {
    console.error('[AutoCategorize] AI error:', error);
    return null;
  }
}

/**
 * Auto-categorize a transaction
 *
 * @param userId - The user's ID
 * @param description - Transaction description
 * @param amountCents - Transaction amount in cents
 * @param transactionType - 'income' or 'expense'
 * @returns The suggested categoryId or null if no confident match
 */
export async function autoCategorize(
  userId: string,
  description: string,
  amountCents: number,
  transactionType: 'income' | 'expense'
): Promise<string | null> {
  // 1. Try learned patterns first (fast, no API calls)
  const patternSuggestion = await suggestFromPatterns(
    userId,
    description,
    amountCents
  );

  if (patternSuggestion) {
    console.log(
      `[AutoCategorize] Pattern match: ${patternSuggestion.categoryName} (confidence: ${patternSuggestion.confidence})`
    );
    return patternSuggestion.categoryId;
  }

  // 2. Try AI analysis (slower, requires API key)
  const aiSuggestion = await suggestFromAI(
    userId,
    description,
    transactionType
  );

  if (aiSuggestion) {
    console.log(
      `[AutoCategorize] AI match: ${aiSuggestion.categoryName} (confidence: ${aiSuggestion.confidence})`
    );
    return aiSuggestion.categoryId;
  }

  // 3. No confident match - leave uncategorized
  console.log('[AutoCategorize] No confident match, leaving uncategorized');
  return null;
}

/**
 * Learn a pattern from a user's categorization
 * Called when a user manually categorizes a transaction
 */
export async function learnFromCategorization(
  description: string,
  categoryId: string
): Promise<void> {
  const db = await getDb();
  const now = Date.now();

  // Extract keywords from description (simple word extraction)
  const keywords = extractKeywords(description);

  for (const keyword of keywords) {
    if (keyword.length >= 3) {
      // Check if pattern exists
      const existing = await db.query.categoryPatterns.findFirst({
        where: and(
          eq(categoryPatterns.categoryId, categoryId),
          eq(categoryPatterns.patternType, 'keyword'),
          eq(categoryPatterns.patternValue, keyword.toLowerCase())
        ),
      });

      if (existing) {
        // Increase confidence and match count
        const newConfidence = Math.min(1.0, existing.confidence + 0.1);
        await db
          .update(categoryPatterns)
          .set({
            matchCount: existing.matchCount + 1,
            confidence: newConfidence,
            updatedAt: now,
          })
          .where(eq(categoryPatterns.id, existing.id));
      } else {
        // Create new pattern
        await db.insert(categoryPatterns).values({
          id: nanoid(),
          categoryId,
          patternType: 'keyword',
          patternValue: keyword.toLowerCase(),
          matchCount: 1,
          confidence: 0.5, // Start at 50% confidence
          learnedFrom: 'user_action',
          createdAt: now,
          updatedAt: now,
        });
      }
    }
  }
}

/**
 * Extract meaningful keywords from a description
 */
function extractKeywords(description: string): string[] {
  const stopWords = new Set([
    'the',
    'a',
    'an',
    'and',
    'or',
    'but',
    'in',
    'on',
    'at',
    'to',
    'for',
    'of',
    'with',
    'by',
    'from',
    'as',
    'is',
    'was',
    'are',
    'were',
    'been',
    'be',
    'have',
    'has',
    'had',
    'do',
    'does',
    'did',
    'will',
    'would',
    'could',
    'should',
    'may',
    'might',
    'must',
    'shall',
    'can',
    'need',
    'pos',
    'terminal',
    'purchase',
    'payment',
    'card',
    'debit',
    'credit',
    'el',
    'la',
    'los',
    'las',
    'un',
    'una',
    'de',
    'del',
    'en',
    'con',
    'por',
    'para',
    'que',
    'se',
    'su',
    'al',
    'es',
    'y',
    'o',
    'no',
    'si',
    'como',
  ]);

  const words = description
    .toLowerCase()
    .split(/[^a-z0-9áéíóúñ]+/)
    .filter((word) => word.length >= 3 && !stopWords.has(word));

  return [...new Set(words)];
}
