/**
 * PDF Parser
 *
 * Extracts transaction data from PDF documents using Claude's native PDF support.
 * Handles multi-page bank statements and financial documents.
 */

import Anthropic from '@anthropic-ai/sdk';
import { safeParseJson } from './llm';
import type {
  ParsedReceipt,
  ParsedBankStatement,
  ParsedSummary,
  ParsedTransactionRow,
} from './types';

const SYSTEM_PROMPT = `You are a financial document parser specialized in extracting transaction data from PDF documents like bank statements, credit card statements, and invoices.

Your task is to analyze PDF documents and extract structured financial information.

FIRST, determine the document type:
- "receipt" or "invoice": A single purchase document with one main transaction
- "bank_statement": A list of multiple transactions (bank statement, credit card statement, transaction history)

IMPORTANT RULES:
1. For receipts/invoices: Extract the MAIN transaction (total amount paid/due)
2. For transaction lists: Extract ALL visible transactions from ALL pages
3. Identify merchant/description names clearly
4. Extract dates if visible (format as YYYY-MM-DD)
5. Detect the currency from symbols or context:
   - $ alone typically means USD
   - B/. or PAB means Panamanian Balboa (treat as USD, 1:1 peg)
   - € means EUR
6. Amounts should be POSITIVE decimals (e.g., 25.99)
7. For transaction lists, determine if each transaction is a credit (income/deposit) or debit (expense/withdrawal)
8. If unsure about any field, make your best guess
9. For multi-page documents, extract transactions from ALL pages

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
  "period": {
    "from": "YYYY-MM-DD or null",
    "to": "YYYY-MM-DD or null"
  },
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

const USER_PROMPT = `Analyze this PDF document and extract ALL financial transaction information.
If this is a multi-page document, make sure to extract transactions from EVERY page.
Return ONLY valid JSON matching the appropriate structure based on what type of document this is.`;

export interface PdfParserResult {
  success: true;
  summary: ParsedSummary;
}

export interface PdfParserError {
  success: false;
  error: string;
}

export type PdfParserOutput = PdfParserResult | PdfParserError;

let anthropicClient: Anthropic | null = null;

function getAnthropicClient(): Anthropic {
  if (anthropicClient) return anthropicClient;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY environment variable is required');
  }

  anthropicClient = new Anthropic({ apiKey });
  return anthropicClient;
}

export async function parsePdfDocument(
  pdfBase64: string,
  _file: { mimeType: string; filename: string }
): Promise<PdfParserOutput> {
  try {
    const client = getAnthropicClient();

    // Use Claude's native PDF support via document block
    // Use streaming to handle long-running requests (>10 min timeout protection)
    const stream = client.messages.stream({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 16384, // High limit for large multi-page bank statements
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'document',
              source: {
                type: 'base64',
                media_type: 'application/pdf',
                data: pdfBase64,
              },
            },
            {
              type: 'text',
              text: USER_PROMPT,
            },
          ],
        },
      ],
    });

    const response = await stream.finalMessage();

    // Check if response was truncated
    if (response.stop_reason === 'max_tokens') {
      console.warn(
        '[pdfParser] Response was truncated due to max_tokens limit'
      );
    }

    const textContent = response.content.find((c) => c.type === 'text');
    const responseText =
      textContent && textContent.type === 'text' ? textContent.text : '';

    console.log(
      `[pdfParser] Response length: ${responseText.length} chars, stop_reason: ${response.stop_reason}`
    );

    const parsed = safeParseJson<RawPdfParseResult>(responseText);

    if (!parsed) {
      return {
        success: false,
        error: `Failed to parse LLM response as JSON: ${responseText.slice(0, 200)}`,
      };
    }

    if (parsed.documentType === 'bank_statement') {
      return validateBankStatement(parsed);
    } else {
      return validateReceipt(parsed);
    }
  } catch (error) {
    console.error('[pdfParser] Error:', error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Unknown error during PDF parsing',
    };
  }
}

interface RawPdfParseResult {
  documentType?: string;
  currency?: string;
  mainTransaction?: {
    id?: string;
    date?: string;
    merchant?: string;
    amount?: number | string;
    categoryGuess?: string | null;
    notes?: string | null;
  };
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
  }>;
}

function validateReceipt(raw: RawPdfParseResult): PdfParserOutput {
  const documentType = raw.documentType;
  if (documentType !== 'receipt' && documentType !== 'invoice') {
    return {
      success: false,
      error: `Invalid document type: ${documentType}`,
    };
  }

  const currency = raw.currency?.toUpperCase() || 'USD';
  if (currency.length !== 3) {
    return {
      success: false,
      error: `Invalid currency code: ${currency}`,
    };
  }

  const mt = raw.mainTransaction;
  if (!mt) {
    return {
      success: false,
      error: 'Missing main transaction',
    };
  }

  let amount =
    typeof mt.amount === 'string' ? parseFloat(mt.amount) : mt.amount;
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
      error: `Amount too large (possible parsing error): ${amount}`,
    };
  }

  const merchant = mt.merchant?.trim();
  if (!merchant) {
    return {
      success: false,
      error: 'Missing merchant name',
    };
  }

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

function validateBankStatement(raw: RawPdfParseResult): PdfParserOutput {
  const currency = raw.currency?.toUpperCase() || 'USD';
  if (currency.length !== 3) {
    return {
      success: false,
      error: `Invalid currency code: ${currency}`,
    };
  }

  if (!raw.transactions || !Array.isArray(raw.transactions)) {
    return {
      success: false,
      error: 'Missing transactions array',
    };
  }

  if (raw.transactions.length === 0) {
    return {
      success: false,
      error: 'No transactions found in PDF',
    };
  }

  const validatedTransactions: ParsedTransactionRow[] = [];
  for (let i = 0; i < raw.transactions.length; i++) {
    const tx = raw.transactions[i];
    if (!tx) continue;

    let amount =
      typeof tx.amount === 'string' ? parseFloat(tx.amount) : tx.amount;
    if (typeof amount !== 'number' || !Number.isFinite(amount)) {
      console.warn(
        `[pdfParser] Skipping transaction ${i}: invalid amount ${tx.amount}`
      );
      continue;
    }

    amount = Math.abs(amount);

    if (amount > 1_000_000_000) {
      console.warn(
        `[pdfParser] Skipping transaction ${i}: amount too large ${amount}`
      );
      continue;
    }

    const description = tx.description?.trim();
    if (!description) {
      console.warn(
        `[pdfParser] Skipping transaction ${i}: missing description`
      );
      continue;
    }

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
      error: 'No valid transactions could be parsed from PDF',
    };
  }

  const result: ParsedBankStatement = {
    documentType: 'bank_statement',
    currency,
    accountName: raw.accountName || null,
    period: raw.period || undefined,
    transactions: validatedTransactions,
  };

  return {
    success: true,
    summary: result,
  };
}

function normalizeDate(dateStr: string | undefined | null): string | null {
  if (!dateStr) {
    return new Date().toISOString().split('T')[0]!;
  }

  const isoMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  }

  const slashMatch = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const [, first, second, year] = slashMatch;
    const month = first!.padStart(2, '0');
    const day = second!.padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

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
