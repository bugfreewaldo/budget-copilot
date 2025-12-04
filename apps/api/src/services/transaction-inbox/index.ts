/**
 * Transaction Inbox Service
 *
 * Handles the "swipe-to-categorize" inbox system where users review
 * extracted transactions and approve/reject them with category assignments.
 *
 * Key features:
 * - Auto-categorization using learned patterns
 * - Category learning from user actions
 * - Batch operations for quick review
 */

import { nanoid } from 'nanoid';
import { getDb } from '../../db/client.js';
import {
  transactionInbox,
  transactions,
  categoryPatterns,
  categories,
} from '../../db/schema.js';
import { eq, and, desc } from 'drizzle-orm';
import type {
  TransactionInboxItem,
  NewTransactionInboxItem,
  NewTransaction,
  CategoryPattern,
} from '../../db/schema.js';

// Types
export interface InboxItemWithSuggestion extends TransactionInboxItem {
  suggestedCategoryName?: string;
  alternativeCategories?: CategorySuggestion[];
}

export interface ApproveInboxItemParams {
  inboxItemId: string;
  categoryId: string;
  accountId: string;
  userId: string;
  date?: string; // Override extracted date
  description?: string; // Override extracted description
  notes?: string;
}

export interface CategorySuggestion {
  categoryId: string;
  categoryName: string;
  confidence: number;
  matchedPattern?: string;
}

/**
 * Get all pending inbox items with category suggestions
 */
export async function getPendingInboxItems(
  limit = 50,
  offset = 0
): Promise<InboxItemWithSuggestion[]> {
  const db = await getDb();

  const items = await db.query.transactionInbox.findMany({
    where: eq(transactionInbox.status, 'pending'),
    orderBy: [desc(transactionInbox.createdAt)],
    limit,
    offset,
  });

  // Enrich with category names
  const enrichedItems: InboxItemWithSuggestion[] = [];

  for (const item of items) {
    const enriched: InboxItemWithSuggestion = { ...item };

    if (item.suggestedCategoryId) {
      const category = await db.query.categories.findFirst({
        where: eq(categories.id, item.suggestedCategoryId),
      });
      enriched.suggestedCategoryName = category?.name;
    }

    // Get alternative suggestions
    enriched.alternativeCategories = await suggestCategories(
      item.rawDescription,
      item.rawMerchant || undefined,
      item.rawAmountCents
    );

    enrichedItems.push(enriched);
  }

  return enrichedItems;
}

/**
 * Get inbox item by ID
 */
export async function getInboxItem(
  id: string
): Promise<InboxItemWithSuggestion | null> {
  const db = await getDb();

  const item = await db.query.transactionInbox.findFirst({
    where: eq(transactionInbox.id, id),
  });

  if (!item) return null;

  const enriched: InboxItemWithSuggestion = { ...item };

  if (item.suggestedCategoryId) {
    const category = await db.query.categories.findFirst({
      where: eq(categories.id, item.suggestedCategoryId),
    });
    enriched.suggestedCategoryName = category?.name;
  }

  enriched.alternativeCategories = await suggestCategories(
    item.rawDescription,
    item.rawMerchant || undefined,
    item.rawAmountCents
  );

  return enriched;
}

/**
 * Approve an inbox item and create a transaction
 */
export async function approveInboxItem(
  params: ApproveInboxItemParams
): Promise<{ transactionId: string }> {
  const db = await getDb();

  const item = await db.query.transactionInbox.findFirst({
    where: eq(transactionInbox.id, params.inboxItemId),
  });

  if (!item) {
    throw new Error('Inbox item not found');
  }

  if (item.status !== 'pending') {
    throw new Error('Inbox item already processed');
  }

  const now = Date.now();
  const transactionId = nanoid();

  // Create the transaction
  const newTransaction: NewTransaction = {
    id: transactionId,
    userId: params.userId,
    date: params.date || item.rawDate || new Date().toISOString().split('T')[0],
    description: params.description || item.rawDescription,
    amountCents: item.rawAmountCents,
    type: item.rawAmountCents < 0 ? 'expense' : 'income',
    categoryId: params.categoryId,
    accountId: params.accountId,
    cleared: false,
    notes: params.notes,
    createdAt: now,
    updatedAt: now,
  };

  await db.insert(transactions).values(newTransaction);

  // Update inbox item status
  await db
    .update(transactionInbox)
    .set({
      status: 'approved',
      approvedTransactionId: transactionId,
      reviewedAt: now,
    })
    .where(eq(transactionInbox.id, params.inboxItemId));

  // Learn from this categorization
  await learnFromCategorization(
    item.rawDescription,
    item.rawMerchant || undefined,
    params.categoryId
  );

  return { transactionId };
}

/**
 * Reject an inbox item (mark as not a real transaction)
 */
export async function rejectInboxItem(inboxItemId: string): Promise<void> {
  const db = await getDb();

  await db
    .update(transactionInbox)
    .set({
      status: 'rejected',
      reviewedAt: Date.now(),
    })
    .where(eq(transactionInbox.id, inboxItemId));
}

/**
 * Merge inbox item with existing transaction (duplicate detection)
 */
export async function mergeInboxItem(
  inboxItemId: string,
  existingTransactionId: string
): Promise<void> {
  const db = await getDb();

  await db
    .update(transactionInbox)
    .set({
      status: 'merged',
      approvedTransactionId: existingTransactionId,
      reviewedAt: Date.now(),
    })
    .where(eq(transactionInbox.id, inboxItemId));
}

/**
 * Batch approve multiple inbox items with same category
 */
export async function batchApproveInboxItems(
  itemIds: string[],
  categoryId: string,
  accountId: string,
  userId: string
): Promise<{ transactionIds: string[] }> {
  const transactionIds: string[] = [];

  for (const itemId of itemIds) {
    const result = await approveInboxItem({
      inboxItemId: itemId,
      categoryId,
      accountId,
      userId,
    });
    transactionIds.push(result.transactionId);
  }

  return { transactionIds };
}

/**
 * Suggest categories based on learned patterns
 */
export async function suggestCategories(
  description: string,
  merchant?: string,
  amountCents?: number
): Promise<CategorySuggestion[]> {
  const db = await getDb();
  const suggestions: CategorySuggestion[] = [];

  // Get all patterns ordered by confidence
  const patterns = await db.query.categoryPatterns.findMany({
    orderBy: [desc(categoryPatterns.confidence)],
  });

  const descLower = description.toLowerCase();
  const merchantLower = merchant?.toLowerCase() || '';

  for (const pattern of patterns) {
    let matched = false;

    switch (pattern.patternType) {
      case 'merchant':
        if (
          merchantLower &&
          merchantLower.includes(pattern.patternValue.toLowerCase())
        ) {
          matched = true;
        }
        break;

      case 'keyword':
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
        if (amountCents !== undefined) {
          try {
            const [min, max] = pattern.patternValue.split('-').map(Number);
            const absAmount = Math.abs(amountCents);
            if (absAmount >= min && absAmount <= max) {
              matched = true;
            }
          } catch {
            // Invalid range format, skip
          }
        }
        break;
    }

    if (matched) {
      // Check if category already suggested
      const existing = suggestions.find(
        (s) => s.categoryId === pattern.categoryId
      );
      if (!existing) {
        // Get category name
        const category = await db.query.categories.findFirst({
          where: eq(categories.id, pattern.categoryId),
        });

        if (category) {
          suggestions.push({
            categoryId: pattern.categoryId,
            categoryName: category.name,
            confidence: pattern.confidence,
            matchedPattern: pattern.patternValue,
          });
        }
      }
    }
  }

  // Sort by confidence and limit to top 5
  return suggestions.sort((a, b) => b.confidence - a.confidence).slice(0, 5);
}

/**
 * Learn from user categorization to improve future suggestions
 */
async function learnFromCategorization(
  description: string,
  merchant: string | undefined,
  categoryId: string
): Promise<void> {
  const _db = await getDb();
  const _now = Date.now();

  // Extract keywords from description (simple word extraction)
  const keywords = extractKeywords(description);

  // Learn merchant pattern if available
  if (merchant) {
    await upsertPattern({
      categoryId,
      patternType: 'merchant',
      patternValue: merchant.toLowerCase(),
      learnedFrom: 'user_action',
    });
  }

  // Learn keyword patterns
  for (const keyword of keywords) {
    if (keyword.length >= 3) {
      // Only learn keywords with 3+ chars
      await upsertPattern({
        categoryId,
        patternType: 'keyword',
        patternValue: keyword.toLowerCase(),
        learnedFrom: 'user_action',
      });
    }
  }
}

/**
 * Upsert a category pattern (create or update confidence)
 */
async function upsertPattern(params: {
  categoryId: string;
  patternType: CategoryPattern['patternType'];
  patternValue: string;
  learnedFrom: CategoryPattern['learnedFrom'];
}): Promise<void> {
  const db = await getDb();
  const now = Date.now();

  // Check if pattern exists
  const existing = await db.query.categoryPatterns.findFirst({
    where: and(
      eq(categoryPatterns.categoryId, params.categoryId),
      eq(categoryPatterns.patternType, params.patternType),
      eq(categoryPatterns.patternValue, params.patternValue)
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
      categoryId: params.categoryId,
      patternType: params.patternType,
      patternValue: params.patternValue,
      matchCount: 1,
      confidence: 0.5, // Start at 50% confidence
      learnedFrom: params.learnedFrom,
      createdAt: now,
      updatedAt: now,
    });
  }
}

/**
 * Extract meaningful keywords from a description
 */
function extractKeywords(description: string): string[] {
  // Remove common words and extract meaningful terms
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
    'dare',
    'ought',
    'used',
    'pos',
    'terminal',
    'purchase',
    'payment',
    'card',
    'debit',
    'credit',
  ]);

  // Split by non-alphanumeric, filter, and return unique
  const words = description
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length >= 3 && !stopWords.has(word));

  return [...new Set(words)];
}

/**
 * Get inbox statistics
 */
export async function getInboxStats(): Promise<{
  pending: number;
  approved: number;
  rejected: number;
  total: number;
}> {
  const db = await getDb();

  const pending = await db.query.transactionInbox.findMany({
    where: eq(transactionInbox.status, 'pending'),
  });

  const approved = await db.query.transactionInbox.findMany({
    where: eq(transactionInbox.status, 'approved'),
  });

  const rejected = await db.query.transactionInbox.findMany({
    where: eq(transactionInbox.status, 'rejected'),
  });

  return {
    pending: pending.length,
    approved: approved.length,
    rejected: rejected.length,
    total: pending.length + approved.length + rejected.length,
  };
}

/**
 * Add item manually to inbox (for testing or manual entry)
 */
export async function addToInbox(
  item: Omit<NewTransactionInboxItem, 'id' | 'createdAt'>
): Promise<string> {
  const db = await getDb();
  const id = nanoid();

  // Get category suggestion
  const suggestions = await suggestCategories(
    item.rawDescription,
    item.rawMerchant || undefined,
    item.rawAmountCents
  );

  await db.insert(transactionInbox).values({
    ...item,
    id,
    suggestedCategoryId: suggestions[0]?.categoryId,
    suggestionConfidence: suggestions[0]?.confidence,
    createdAt: Date.now(),
  });

  return id;
}
