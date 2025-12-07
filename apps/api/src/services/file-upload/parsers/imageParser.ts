/**
 * Image Parser
 *
 * Extracts transaction data from images (receipts, invoices, screenshots).
 * Uses a vision model (Claude/GPT-4V) to analyze the image content.
 *
 * Supports:
 * - Single receipts/invoices → returns ParsedReceipt
 * - Transaction lists (bank app screenshots, statements) → returns ParsedBankStatement
 */

import { callVisionModel, safeParseJson } from '../llm.js';
import type {
  ParsedReceipt,
  ParsedBankStatement,
  ParsedSummary,
  ParsedTransactionRow,
} from '../types.js';
import type { UploadedFile } from '../../../db/schema.js';

// ============================================================================
// Prompts
// ============================================================================

const SYSTEM_PROMPT = `You are a financial document parser specialized in extracting transaction data from receipts, invoices, and screenshots.

Your task is to analyze images and extract structured financial information.

FIRST, determine the document type:
- "receipt" or "invoice": A single purchase document with one main transaction (store receipt, restaurant bill, invoice)
- "bank_statement": A list of multiple transactions (banking app screenshot, account statement, transaction history)

IMPORTANT RULES:
1. For receipts/invoices: Extract the MAIN transaction (total amount paid/due)
2. For transaction lists: Extract ALL visible transactions
3. Identify merchant/description names clearly
4. Extract dates if visible (format as YYYY-MM-DD)
5. Detect the currency from symbols or context:
   - $ alone typically means USD
   - B/. or PAB means Panamanian Balboa (treat as USD, 1:1 peg)
   - € means EUR
6. Amounts should be POSITIVE decimals (e.g., 25.99)
7. For transaction lists, determine if each transaction is a credit (income/deposit) or debit (expense/withdrawal)
8. If unsure about any field, make your best guess

COMMON PANAMA MERCHANTS to recognize:
- Super 99, Riba Smith, Rey (supermarkets)
- McDonald's, KFC, Popeyes (fast food)
- PriceSmart (wholesale)
- Farmacias Arrocha, Metro Plus (pharmacies)
- Copa Airlines
- Banco General, Banistmo, BAC (banks)

FOR SINGLE RECEIPT/INVOICE, return:
{
  "documentType": "receipt" | "invoice",
  "currency": "USD" | "PAB" | "EUR" | etc.,
  "mainTransaction": {
    "id": "main",
    "date": "YYYY-MM-DD",
    "merchant": "Merchant Name",
    "amount": 0.00,
    "categoryGuess": "suggested category or null",
    "notes": "any additional info or null"
  }
}

FOR TRANSACTION LIST/BANK STATEMENT, return:
{
  "documentType": "bank_statement",
  "currency": "USD" | "PAB" | "EUR" | etc.,
  "accountName": "Account name if visible or null",
  "transactions": [
    {
      "id": "row_1",
      "date": "YYYY-MM-DD or null",
      "description": "Transaction description",
      "amount": 0.00,
      "isCredit": true | false,
      "categoryGuess": "suggested category or null"
    }
  ]
}`;

const USER_PROMPT = `Analyze this image and extract the financial transaction information.
Return ONLY valid JSON matching the appropriate structure based on what type of document this is.`;

// ============================================================================
// Parser Implementation
// ============================================================================

export interface ImageParserResult {
  success: true;
  summary: ParsedSummary;
}

export interface ImageParserError {
  success: false;
  error: string;
}

export type ImageParserOutput = ImageParserResult | ImageParserError;

/**
 * Parse an image document using vision model
 * Handles both single receipts and transaction lists
 */
export async function parseImageDocument(
  imageBase64: string,
  file: Pick<UploadedFile, 'mimeType' | 'filename'>
): Promise<ImageParserOutput> {
  try {
    // Call the vision model
    const response = await callVisionModel({
      imageBase64,
      mimeType: file.mimeType,
      systemPrompt: SYSTEM_PROMPT,
      userPrompt: USER_PROMPT,
      maxTokens: 4096, // Increased for transaction lists
    });

    // Parse the JSON response
    const parsed = safeParseJson<RawImageParseResult>(response.text);

    if (!parsed) {
      return {
        success: false,
        error: `Failed to parse LLM response as JSON: ${response.text.slice(0, 200)}`,
      };
    }

    // Validate and normalize based on document type
    if (parsed.documentType === 'bank_statement') {
      return validateBankStatement(parsed);
    } else {
      return validateReceipt(parsed);
    }
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'Unknown error during image parsing',
    };
  }
}

// ============================================================================
// Raw Response Types
// ============================================================================

interface RawImageParseResult {
  documentType?: string;
  currency?: string;
  // For receipts
  mainTransaction?: {
    id?: string;
    date?: string;
    merchant?: string;
    amount?: number | string;
    categoryGuess?: string | null;
    notes?: string | null;
  };
  // For bank statements
  accountName?: string | null;
  transactions?: Array<{
    id?: string;
    date?: string | null;
    description?: string;
    amount?: number | string;
    isCredit?: boolean;
    categoryGuess?: string | null;
  }>;
}

// ============================================================================
// Receipt Validation
// ============================================================================

function validateReceipt(raw: RawImageParseResult): ImageParserOutput {
  // Validate document type
  const documentType = raw.documentType;
  if (documentType !== 'receipt' && documentType !== 'invoice') {
    return {
      success: false,
      error: `Invalid document type: ${documentType}`,
    };
  }

  // Validate currency
  const currency = raw.currency?.toUpperCase() || 'USD';
  if (currency.length !== 3) {
    return {
      success: false,
      error: `Invalid currency code: ${currency}`,
    };
  }

  // Validate main transaction
  const mt = raw.mainTransaction;
  if (!mt) {
    return {
      success: false,
      error: 'Missing main transaction',
    };
  }

  // Validate amount
  let amount =
    typeof mt.amount === 'string' ? parseFloat(mt.amount) : mt.amount;
  if (typeof amount !== 'number' || !Number.isFinite(amount)) {
    return {
      success: false,
      error: `Invalid amount: ${mt.amount}`,
    };
  }

  // Ensure amount is positive (for receipts, it represents what was paid)
  amount = Math.abs(amount);

  // Reject absurdly large amounts (likely parsing error)
  if (amount > 1_000_000_000) {
    return {
      success: false,
      error: `Amount too large (possible parsing error): ${amount}`,
    };
  }

  // Validate merchant
  const merchant = mt.merchant?.trim();
  if (!merchant) {
    return {
      success: false,
      error: 'Missing merchant name',
    };
  }

  // Validate date
  const date = normalizeDate(mt.date);
  if (!date) {
    return {
      success: false,
      error: `Invalid date format: ${mt.date}`,
    };
  }

  const result: ParsedReceipt = {
    documentType,
    currency,
    mainTransaction: {
      id: 'main',
      date,
      merchant,
      amount,
      categoryGuess: mt.categoryGuess || null,
      notes: mt.notes || null,
    },
  };

  return {
    success: true,
    summary: result,
  };
}

// ============================================================================
// Bank Statement Validation
// ============================================================================

function validateBankStatement(raw: RawImageParseResult): ImageParserOutput {
  // Validate currency
  const currency = raw.currency?.toUpperCase() || 'USD';
  if (currency.length !== 3) {
    return {
      success: false,
      error: `Invalid currency code: ${currency}`,
    };
  }

  // Validate transactions array
  if (!raw.transactions || !Array.isArray(raw.transactions)) {
    return {
      success: false,
      error: 'Missing transactions array',
    };
  }

  if (raw.transactions.length === 0) {
    return {
      success: false,
      error: 'No transactions found in image',
    };
  }

  // Validate each transaction
  const validatedTransactions: ParsedTransactionRow[] = [];
  for (let i = 0; i < raw.transactions.length; i++) {
    const tx = raw.transactions[i];
    if (!tx) continue;

    // Parse amount
    let amount =
      typeof tx.amount === 'string' ? parseFloat(tx.amount) : tx.amount;
    if (typeof amount !== 'number' || !Number.isFinite(amount)) {
      console.warn(`Skipping transaction ${i}: invalid amount ${tx.amount}`);
      continue;
    }

    // Ensure amount is positive (isCredit determines sign)
    amount = Math.abs(amount);

    // Skip absurdly large amounts
    if (amount > 1_000_000_000) {
      console.warn(`Skipping transaction ${i}: amount too large ${amount}`);
      continue;
    }

    // Validate description
    const description = tx.description?.trim();
    if (!description) {
      console.warn(`Skipping transaction ${i}: missing description`);
      continue;
    }

    // Normalize date (can be null for bank statements)
    const date = tx.date ? normalizeDate(tx.date) : null;

    validatedTransactions.push({
      id: tx.id || `row_${i + 1}`,
      date,
      description,
      amount,
      isCredit: tx.isCredit === true,
      categoryGuess: tx.categoryGuess || null,
    });
  }

  if (validatedTransactions.length === 0) {
    return {
      success: false,
      error: 'No valid transactions could be parsed',
    };
  }

  const result: ParsedBankStatement = {
    documentType: 'bank_statement',
    currency,
    accountName: raw.accountName || null,
    transactions: validatedTransactions,
  };

  return {
    success: true,
    summary: result,
  };
}

// ============================================================================
// Date Normalization
// ============================================================================

/**
 * Normalize various date formats to YYYY-MM-DD
 */
function normalizeDate(dateStr: string | undefined | null): string | null {
  if (!dateStr) {
    // If no date provided, use today
    return new Date().toISOString().split('T')[0]!;
  }

  // Try parsing as ISO date first
  const isoMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  }

  // Try common formats: MM/DD/YYYY, DD/MM/YYYY
  const slashMatch = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const [, first, second, year] = slashMatch;
    // Assume MM/DD/YYYY for US-style dates
    const month = first!.padStart(2, '0');
    const day = second!.padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // Try parsing with Date constructor
  try {
    const parsed = new Date(dateStr);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString().split('T')[0]!;
    }
  } catch {
    // Fall through
  }

  return null;
}
