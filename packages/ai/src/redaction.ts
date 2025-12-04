/**
 * PII redaction utilities to protect sensitive data before sending to LLMs
 */

export interface RedactionRule {
  pattern: RegExp;
  replacement: string;
}

/**
 * Common PII patterns to redact
 */
export const DEFAULT_REDACTION_RULES: RedactionRule[] = [
  // Credit card numbers (basic pattern)
  {
    pattern: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
    replacement: '[CARD]',
  },
  // Social Security Numbers
  {
    pattern: /\b\d{3}-\d{2}-\d{4}\b/g,
    replacement: '[SSN]',
  },
  // Email addresses
  {
    pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    replacement: '[EMAIL]',
  },
  // Phone numbers (US format)
  {
    pattern: /\b(\+?1[-.]?)?\(?\d{3}\)?[-.]?\d{3}[-.]?\d{4}\b/g,
    replacement: '[PHONE]',
  },
  // IP addresses
  {
    pattern: /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g,
    replacement: '[IP]',
  },
];

/**
 * Redact PII from text using provided rules
 */
export function redactPII(
  text: string,
  rules: RedactionRule[] = DEFAULT_REDACTION_RULES
): string {
  let redacted = text;

  for (const rule of rules) {
    redacted = redacted.replace(rule.pattern, rule.replacement);
  }

  return redacted;
}

/**
 * Redact specific transaction fields while preserving structure
 */
export interface RedactableTransaction {
  id?: string;
  date: Date | string;
  description: string;
  amount: number;
  [key: string]: unknown;
}

export function redactTransaction(
  transaction: RedactableTransaction
): RedactableTransaction {
  return {
    ...transaction,
    description: redactPII(transaction.description),
    // Remove ID if it contains PII
    id: transaction.id ? '[REDACTED_ID]' : undefined,
  };
}

/**
 * Redact an array of transactions
 */
export function redactTransactions(
  transactions: RedactableTransaction[]
): RedactableTransaction[] {
  return transactions.map(redactTransaction);
}

/**
 * Create a safe summary of transactions for LLM prompts
 */
export function createSafeSummary(
  transactions: RedactableTransaction[]
): string {
  const redacted = redactTransactions(transactions);

  return redacted
    .map((txn) => {
      const date =
        typeof txn.date === 'string' ? txn.date : txn.date.toISOString();
      return `${date}: ${txn.description} - $${txn.amount.toFixed(2)}`;
    })
    .join('\n');
}
