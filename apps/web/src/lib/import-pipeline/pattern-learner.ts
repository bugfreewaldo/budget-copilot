/**
 * Pattern Learner
 *
 * Learns category patterns from user corrections during import.
 * Patterns are stored in the `category_patterns` table and used
 * for future auto-categorization (prioritized over hardcoded patterns).
 */

import { eq, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { getDb } from '@/lib/db/client';
import { categoryPatterns } from '@/lib/db/schema';

interface CategorizedTransaction {
  description: string;
  categoryId: string | null;
  categoryName: string | null;
  source: 'learned' | 'pattern' | 'ai' | 'llm' | 'none';
}

/**
 * Normalize a transaction description for pattern matching.
 * Strips noise like transaction codes, card numbers, dates, etc.
 */
function normalizeDescription(desc: string): string {
  return (
    desc
      .toLowerCase()
      .trim()
      // Remove common transaction prefixes
      .replace(/^(pos|compra|purchase|payment|pago|debit|credit)\s*/i, '')
      // Remove card number fragments (last 4 digits patterns)
      .replace(/\*+\d{4}/g, '')
      // Remove transaction IDs / reference numbers
      .replace(/\b[a-f0-9]{8,}\b/gi, '')
      // Remove dates in common formats
      .replace(/\d{1,2}[/-]\d{1,2}[/-]\d{2,4}/g, '')
      // Collapse whitespace
      .replace(/\s+/g, ' ')
      .trim()
  );
}

/**
 * Extract a short merchant name from a description.
 * Takes the first 2-3 significant words.
 */
function extractMerchant(normalized: string): string | null {
  const words = normalized.split(' ').filter((w) => w.length > 2);
  if (words.length === 0) return null;
  return words.slice(0, 3).join(' ');
}

/**
 * Learn patterns from a batch of categorized transactions.
 * Called after the user confirms an import with category assignments.
 *
 * @param userId - The user who categorized these transactions
 * @param transactions - Transactions with their assigned categories
 */
export async function learnPatternsFromImport(
  userId: string,
  transactions: CategorizedTransaction[]
): Promise<{ learned: number; updated: number }> {
  const db = getDb();
  let learned = 0;
  let updated = 0;

  for (const tx of transactions) {
    if (!tx.categoryId) continue;

    const normalized = normalizeDescription(tx.description);
    if (!normalized || normalized.length < 3) continue;

    // Determine learned_from based on how the category was assigned
    const learnedFrom =
      tx.source === 'llm' || tx.source === 'ai'
        ? ('ai_suggestion' as const)
        : ('user_action' as const);

    // Base confidence: user corrections are high, AI confirmations are medium
    const baseConfidence = learnedFrom === 'user_action' ? 0.85 : 0.65;

    // Try to find existing pattern for this description + user
    const existing = await db
      .select()
      .from(categoryPatterns)
      .where(
        and(
          eq(categoryPatterns.userId, userId),
          eq(categoryPatterns.patternType, 'keyword'),
          eq(categoryPatterns.patternValue, normalized)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      const pattern = existing[0]!;
      // Update: increment match count, boost confidence
      const newConfidence = Math.min(1.0, pattern.confidence + 0.05);
      const newMatchCount = (pattern.matchCount ?? 0) + 1;

      await db
        .update(categoryPatterns)
        .set({
          categoryId: tx.categoryId, // Update to latest category choice
          matchCount: newMatchCount,
          confidence: newConfidence,
          updatedAt: Date.now(),
        })
        .where(eq(categoryPatterns.id, pattern.id));
      updated++;
    } else {
      // Insert new pattern
      await db.insert(categoryPatterns).values({
        id: nanoid(),
        userId,
        categoryId: tx.categoryId,
        patternType: 'keyword',
        patternValue: normalized,
        matchCount: 1,
        confidence: baseConfidence,
        learnedFrom,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      learned++;
    }

    // Also save a merchant-level pattern (shorter, more generalizable)
    const merchant = extractMerchant(normalized);
    if (merchant && merchant !== normalized) {
      const existingMerchant = await db
        .select()
        .from(categoryPatterns)
        .where(
          and(
            eq(categoryPatterns.userId, userId),
            eq(categoryPatterns.patternType, 'merchant'),
            eq(categoryPatterns.patternValue, merchant)
          )
        )
        .limit(1);

      if (existingMerchant.length > 0) {
        const mp = existingMerchant[0]!;
        await db
          .update(categoryPatterns)
          .set({
            categoryId: tx.categoryId,
            matchCount: (mp.matchCount ?? 0) + 1,
            confidence: Math.min(1.0, mp.confidence + 0.03),
            updatedAt: Date.now(),
          })
          .where(eq(categoryPatterns.id, mp.id));
      } else {
        await db.insert(categoryPatterns).values({
          id: nanoid(),
          userId,
          categoryId: tx.categoryId,
          patternType: 'merchant',
          patternValue: merchant,
          matchCount: 1,
          confidence: baseConfidence * 0.8, // Merchant patterns are less specific
          learnedFrom,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
        learned++;
      }
    }
  }

  return { learned, updated };
}

export { normalizeDescription, extractMerchant };
