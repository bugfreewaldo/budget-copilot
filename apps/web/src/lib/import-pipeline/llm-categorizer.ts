/**
 * LLM-Powered Batch Categorizer
 *
 * Uses Claude to categorize transactions that don't match any
 * learned or hardcoded patterns. Sends a single batch request
 * for cost efficiency.
 */

import Anthropic from '@anthropic-ai/sdk';

interface CategoryOption {
  id: string;
  name: string;
  emoji: string | null;
  parentName: string | null;
}

interface UncategorizedTransaction {
  id: string;
  description: string;
  amount: number;
  isCredit: boolean;
  date: string | null;
}

interface LLMCategoryResult {
  transactionId: string;
  categoryId: string | null;
  categoryName: string | null;
  confidence: number;
}

/**
 * Categorize a batch of transactions using Claude.
 *
 * @param transactions - Uncategorized transactions to classify
 * @param categories - User's available categories
 * @param learnedExamples - Sample of user's existing patterns for context
 * @returns Array of category assignments
 */
export async function categorizeBatchWithLLM(
  transactions: UncategorizedTransaction[],
  categories: CategoryOption[],
  learnedExamples?: Array<{ description: string; categoryName: string }>
): Promise<LLMCategoryResult[]> {
  if (transactions.length === 0) return [];

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.warn(
      '[llm-categorizer] No ANTHROPIC_API_KEY, skipping LLM categorization'
    );
    return [];
  }

  const anthropic = new Anthropic();

  // Build category list for the prompt
  const categoryList = categories
    .map(
      (c) =>
        `- ID: "${c.id}" | ${c.emoji || ''} ${c.parentName ? `${c.parentName} > ` : ''}${c.name}`
    )
    .join('\n');

  // Build learned examples section
  const examplesSection =
    learnedExamples && learnedExamples.length > 0
      ? `\nHere are some examples of how this user categorizes their transactions:\n${learnedExamples
          .slice(0, 20)
          .map((e) => `- "${e.description}" -> ${e.categoryName}`)
          .join('\n')}\n`
      : '';

  // Build transaction list (cap at 50 per batch)
  const batch = transactions.slice(0, 50);
  const txList = batch
    .map(
      (tx) =>
        `{ "id": "${tx.id}", "desc": "${tx.description.replace(/"/g, '\\"')}", "amount": ${tx.amount}, "type": "${tx.isCredit ? 'income' : 'expense'}", "date": "${tx.date || 'unknown'}" }`
    )
    .join('\n');

  const prompt = `You are a financial transaction categorizer. Given a list of bank transactions and available categories, assign the best matching category to each transaction.

Available categories:
${categoryList}
${examplesSection}
Transactions to categorize:
${txList}

Respond with a JSON array only. Each element must have:
- "id": the transaction id
- "categoryId": the best matching category ID from the list above, or null if truly uncategorizable
- "confidence": a number 0.0-1.0 representing your confidence

Match based on the merchant/description, amount context, and transaction type. Prefer specific subcategories over parent categories. If the transaction is income, prefer income categories. Return ONLY valid JSON, no markdown.`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    });

    // Extract text from response
    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('');

    // Parse JSON (handle potential markdown wrapping)
    const jsonStr = text
      .replace(/^```json?\s*/, '')
      .replace(/\s*```$/, '')
      .trim();
    const results: Array<{
      id: string;
      categoryId: string | null;
      confidence: number;
    }> = JSON.parse(jsonStr);

    // Validate and build results
    const categoryIds = new Set(categories.map((c) => c.id));

    return results.map((r) => {
      const validCategoryId =
        r.categoryId && categoryIds.has(r.categoryId) ? r.categoryId : null;
      const category = validCategoryId
        ? categories.find((c) => c.id === validCategoryId)
        : null;

      return {
        transactionId: r.id,
        categoryId: validCategoryId,
        categoryName: category?.name ?? null,
        confidence: Math.min(0.75, r.confidence), // Cap LLM confidence
      };
    });
  } catch (error) {
    console.error('[llm-categorizer] Failed to categorize batch:', error);
    return [];
  }
}
