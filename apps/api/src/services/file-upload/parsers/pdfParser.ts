/**
 * PDF Parser
 *
 * Extracts transaction data from PDF documents (bank statements, credit card statements).
 * Uses pdf-parse to extract text, then an LLM to structure the data.
 *
 * Typical use cases:
 * - Monthly bank statements
 * - Credit card statements
 * - Invoice PDFs
 */

import pdfParse from 'pdf-parse';
import { callTextModel, safeParseJson } from '../llm.js';
import type { ParsedBankStatement, ParsedReceipt, ParsedSummary } from '../types.js';
import type { UploadedFile } from '../../../db/schema.js';

// ============================================================================
// Prompts
// ============================================================================

const SYSTEM_PROMPT = `You are a financial document parser specialized in extracting transaction data from bank and credit card statements.

Your task is to analyze the text extracted from a PDF and identify all financial transactions.

IMPORTANT RULES:
1. Extract ALL transactions visible in the document
2. For each transaction, identify:
   - Date (format as YYYY-MM-DD)
   - Description (clean up merchant names, remove extra codes)
   - Amount (as decimal number)
   - Whether it's a credit (positive) or debit (negative)
3. Detect the currency from context (USD, PAB, etc.)
4. If this looks like a receipt/invoice with one main transaction, treat it differently

TRANSACTION CONVENTIONS:
- Debits/Charges/Withdrawals = NEGATIVE amounts (money leaving account)
- Credits/Deposits/Payments = POSITIVE amounts (money entering account)
- For credit cards: Purchases = negative, Payments = positive

COMMON PANAMA BANKS:
- Banco General, Banistmo, BAC Credomatic
- Multibank, Global Bank, Caja de Ahorros
- Banco Nacional de Panama, Banesco

Return ONLY a JSON object with this exact structure:

For bank/credit card statements:
{
  "documentType": "bank_statement",
  "accountName": "Account name if visible or null",
  "period": {
    "from": "YYYY-MM-DD or null",
    "to": "YYYY-MM-DD or null"
  },
  "currency": "USD",
  "transactions": [
    {
      "id": "row_1",
      "date": "YYYY-MM-DD",
      "description": "Clean description",
      "amount": -25.99,
      "isCredit": false,
      "categoryGuess": "suggested category or null",
      "rawRow": "original text or null"
    }
  ]
}

For single receipt/invoice PDFs:
{
  "documentType": "receipt",
  "currency": "USD",
  "mainTransaction": {
    "id": "main",
    "date": "YYYY-MM-DD",
    "merchant": "Merchant Name",
    "amount": 25.99,
    "categoryGuess": "suggested category or null",
    "notes": "any additional info or null"
  }
}`;

const USER_PROMPT_TEMPLATE = `Analyze the following text extracted from a PDF document and extract all financial transactions.

Document text:
---
{TEXT}
---

Return ONLY valid JSON matching one of the specified structures.`;

// ============================================================================
// Parser Implementation
// ============================================================================

export interface PdfParserResult {
  success: true;
  summary: ParsedSummary;
}

export interface PdfParserError {
  success: false;
  error: string;
}

export type PdfParserOutput = PdfParserResult | PdfParserError;

/**
 * Parse a PDF document (bank statement or invoice)
 */
export async function parsePdfDocument(
  pdfBuffer: Buffer,
  _file: Pick<UploadedFile, 'mimeType' | 'filename'>
): Promise<PdfParserOutput> {
  try {
    // Extract text from PDF
    const pdfData = await pdfParse(pdfBuffer);
    let text = pdfData.text;

    // Truncate very long documents to avoid token limits
    const MAX_TEXT_LENGTH = 50000;
    if (text.length > MAX_TEXT_LENGTH) {
      text = text.slice(0, MAX_TEXT_LENGTH) + '\n\n[... truncated due to length ...]';
    }

    if (!text.trim()) {
      return {
        success: false,
        error: 'PDF appears to be empty or contains only images',
      };
    }

    // Call the text model
    const response = await callTextModel({
      systemPrompt: SYSTEM_PROMPT,
      userPrompt: USER_PROMPT_TEMPLATE.replace('{TEXT}', text),
      maxTokens: 8192, // Allow more tokens for bank statements with many transactions
    });

    // Parse the JSON response
    const parsed = safeParseJson<RawPdfParseResult>(response.text);

    if (!parsed) {
      return {
        success: false,
        error: `Failed to parse LLM response as JSON: ${response.text.slice(0, 200)}`,
      };
    }

    // Validate and normalize based on document type
    if (parsed.documentType === 'receipt' || parsed.documentType === 'invoice') {
      return validateReceipt(parsed);
    } else {
      return validateBankStatement(parsed);
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error during PDF parsing',
    };
  }
}

// ============================================================================
// Validation & Normalization
// ============================================================================

interface RawPdfParseResult {
  documentType?: string;
  currency?: string;
  accountName?: string | null;
  period?: {
    from?: string | null;
    to?: string | null;
  };
  transactions?: Array<{
    id?: string;
    date?: string | null;
    description?: string;
    amount?: number | string;
    isCredit?: boolean;
    categoryGuess?: string | null;
    rawRow?: string | null;
  }>;
  mainTransaction?: {
    id?: string;
    date?: string;
    merchant?: string;
    amount?: number | string;
    categoryGuess?: string | null;
    notes?: string | null;
  };
}

function validateReceipt(raw: RawPdfParseResult): PdfParserOutput {
  const currency = raw.currency?.toUpperCase() || 'USD';
  const mt = raw.mainTransaction;

  if (!mt) {
    return {
      success: false,
      error: 'Missing main transaction for receipt',
    };
  }

  let amount = typeof mt.amount === 'string' ? parseFloat(mt.amount) : mt.amount;
  if (typeof amount !== 'number' || !Number.isFinite(amount)) {
    return {
      success: false,
      error: `Invalid amount: ${mt.amount}`,
    };
  }

  amount = Math.abs(amount);

  if (amount > 1_000_000_000) {
    return {
      success: false,
      error: `Amount too large: ${amount}`,
    };
  }

  const merchant = mt.merchant?.trim();
  if (!merchant) {
    return {
      success: false,
      error: 'Missing merchant name',
    };
  }

  const date = normalizeDate(mt.date) || new Date().toISOString().split('T')[0];

  const summary: ParsedReceipt = {
    documentType: raw.documentType === 'invoice' ? 'invoice' : 'receipt',
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

  return { success: true, summary };
}

function validateBankStatement(raw: RawPdfParseResult): PdfParserOutput {
  const currency = raw.currency?.toUpperCase() || 'USD';
  const transactions = raw.transactions || [];

  if (!Array.isArray(transactions)) {
    return {
      success: false,
      error: 'Transactions must be an array',
    };
  }

  const validatedTransactions = [];
  let rowIndex = 1;

  for (const tx of transactions) {
    // Validate amount
    let amount = typeof tx.amount === 'string' ? parseFloat(tx.amount) : tx.amount;
    if (typeof amount !== 'number' || !Number.isFinite(amount)) {
      // Skip invalid transactions
      continue;
    }

    // Reject absurdly large amounts
    if (Math.abs(amount) > 1_000_000_000) {
      continue;
    }

    // Validate description
    const description = tx.description?.trim() || 'Unknown transaction';

    // Determine if credit or debit
    const isCredit = tx.isCredit ?? amount > 0;

    // Normalize date
    const date = normalizeDate(tx.date ?? undefined);

    validatedTransactions.push({
      id: tx.id || `row_${rowIndex}`,
      date,
      description,
      amount,
      isCredit,
      categoryGuess: tx.categoryGuess || null,
      rawRow: tx.rawRow || null,
    });

    rowIndex++;
  }

  const summary: ParsedBankStatement = {
    documentType: 'bank_statement',
    accountName: raw.accountName || null,
    period: raw.period
      ? {
          from: normalizeDate(raw.period.from ?? undefined),
          to: normalizeDate(raw.period.to ?? undefined),
        }
      : undefined,
    currency,
    transactions: validatedTransactions,
  };

  return { success: true, summary };
}

/**
 * Normalize various date formats to YYYY-MM-DD
 */
function normalizeDate(dateStr: string | undefined | null): string | null {
  if (!dateStr) return null;

  // Try parsing as ISO date first
  const isoMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  }

  // Try common formats
  const slashMatch = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const [, first, second, year] = slashMatch;
    const month = first.padStart(2, '0');
    const day = second.padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // Try parsing with Date constructor
  try {
    const parsed = new Date(dateStr);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString().split('T')[0];
    }
  } catch {
    // Fall through
  }

  return null;
}
