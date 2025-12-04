import type { Category, Transaction } from './types';

/**
 * Category matching and assignment logic
 */

export interface CategoryRule {
  pattern: string | RegExp;
  categoryId: string;
  priority: number;
}

/**
 * Match a transaction description against category rules
 */
export function matchCategory(
  description: string,
  rules: CategoryRule[]
): string | null {
  const sortedRules = [...rules].sort((a, b) => b.priority - a.priority);

  for (const rule of sortedRules) {
    const pattern =
      typeof rule.pattern === 'string'
        ? new RegExp(rule.pattern, 'i')
        : rule.pattern;

    if (pattern.test(description)) {
      return rule.categoryId;
    }
  }

  return null;
}

/**
 * Auto-categorize transactions based on rules
 */
export function categorizeTransactions(
  transactions: Transaction[],
  rules: CategoryRule[]
): Transaction[] {
  return transactions.map((txn) => {
    if (txn.categoryId) {
      return txn; // Already categorized
    }

    const categoryId = matchCategory(txn.description, rules);
    return categoryId ? { ...txn, categoryId } : txn;
  });
}

/**
 * Build a category tree from flat category list
 */
export function buildCategoryTree(categories: Category[]): Category[] {
  const rootCategories: Category[] = [];

  for (const category of categories) {
    if (!category.parentId) {
      rootCategories.push(category);
    }
  }

  return rootCategories;
}

/**
 * Get all descendant category IDs for a given category
 */
export function getDescendantCategoryIds(
  categoryId: string,
  allCategories: Category[]
): string[] {
  const descendants: string[] = [];
  const queue = [categoryId];

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    descendants.push(currentId);

    const children = allCategories.filter((c) => c.parentId === currentId);
    queue.push(...children.map((c) => c.id));
  }

  return descendants;
}
