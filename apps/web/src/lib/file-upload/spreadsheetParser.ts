/**
 * Spreadsheet Parser
 *
 * Extracts transaction data from Excel (.xlsx, .xls) and CSV files.
 * Uses xlsx library to read the file, then Claude to interpret the data.
 */

import * as XLSX from 'xlsx';
import Anthropic from '@anthropic-ai/sdk';
import { safeParseJson } from './llm';
import type {
  ParsedBankStatement,
  ParsedSummary,
  ParsedTransactionRow,
} from './types';

const SYSTEM_PROMPT = `You are a financial data parser specialized in extracting transaction data from spreadsheet exports.

You will receive spreadsheet data in a text format (rows and columns). Your task is to identify and extract financial transactions.

IMPORTANT RULES:
1. Identify the header row if present
2. Extract ALL transactions from the data
3. Identify date, description, and amount columns
4. Determine if amounts are credits (income/deposits) or debits (expenses/withdrawals)
5. Look for common patterns:
   - Negative amounts usually mean debits/expenses
   - Positive amounts usually mean credits/deposits
   - Some sheets have separate debit/credit columns
6. Extract dates if visible (format as YYYY-MM-DD)
7. Detect currency from symbols or context (default to USD)
8. Amounts should be POSITIVE decimals (e.g., 25.99)
9. Guess categories based on merchant/description names

COMMON COLUMN PATTERNS:
- Date columns: "Fecha", "Date", "Transaction Date", "Posting Date"
- Description columns: "Descripción", "Description", "Merchant", "Details", "Concepto"
- Amount columns: "Monto", "Amount", "Importe", "Valor"
- Debit columns: "Débito", "Debit", "Cargo", "Retiro"
- Credit columns: "Crédito", "Credit", "Abono", "Depósito"

ALWAYS return this JSON structure:
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

const USER_PROMPT = `Analyze this spreadsheet data and extract ALL financial transactions.
Return ONLY valid JSON matching the structure specified.

Spreadsheet data:
`;

export interface SpreadsheetParserResult {
  success: true;
  summary: ParsedSummary;
}

export interface SpreadsheetParserError {
  success: false;
  error: string;
}

export type SpreadsheetParserOutput =
  | SpreadsheetParserResult
  | SpreadsheetParserError;

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

export async function parseSpreadsheet(
  fileBuffer: Buffer,
  _file: { mimeType: string; filename: string }
): Promise<SpreadsheetParserOutput> {
  try {
    // Parse the spreadsheet file
    let workbook: XLSX.WorkBook;
    try {
      workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    } catch (parseError) {
      return {
        success: false,
        error: `Failed to parse spreadsheet: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`,
      };
    }

    // Get all sheets and their data
    const allSheetsText: string[] = [];

    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      if (!sheet) continue;

      // Convert sheet to array of arrays
      const data = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 });

      if (data.length === 0) continue;

      // Convert to text format for Claude
      const sheetText = formatSheetAsText(data, sheetName);
      if (sheetText) {
        allSheetsText.push(sheetText);
      }
    }

    if (allSheetsText.length === 0) {
      return {
        success: false,
        error: 'No data found in spreadsheet',
      };
    }

    // Combine all sheets
    const combinedText = allSheetsText.join('\n\n---\n\n');

    // Limit text size for API call (roughly 100k chars max)
    const truncatedText = combinedText.slice(0, 100000);
    if (combinedText.length > 100000) {
      console.warn(
        '[spreadsheetParser] Text truncated from',
        combinedText.length,
        'to 100000 chars'
      );
    }

    // Send to Claude for interpretation
    // Use streaming to handle long-running requests (>10 min timeout protection)
    const client = getAnthropicClient();

    const stream = client.messages.stream({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 16384, // High limit for large spreadsheets
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: USER_PROMPT + truncatedText,
        },
      ],
    });

    const response = await stream.finalMessage();

    // Check if response was truncated
    if (response.stop_reason === 'max_tokens') {
      console.warn(
        '[spreadsheetParser] Response was truncated due to max_tokens limit'
      );
    }

    const textContent = response.content.find((c) => c.type === 'text');
    const responseText =
      textContent && textContent.type === 'text' ? textContent.text : '';

    console.log(
      `[spreadsheetParser] Response length: ${responseText.length} chars, stop_reason: ${response.stop_reason}`
    );

    const parsed = safeParseJson<RawSpreadsheetParseResult>(responseText);

    if (!parsed) {
      return {
        success: false,
        error: `Failed to parse LLM response as JSON: ${responseText.slice(0, 200)}`,
      };
    }

    return validateBankStatement(parsed);
  } catch (error) {
    console.error('[spreadsheetParser] Error:', error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Unknown error during spreadsheet parsing',
    };
  }
}

function formatSheetAsText(
  data: (string | number | boolean | undefined)[][],
  sheetName: string
): string | null {
  // Filter out empty rows
  const nonEmptyRows = data.filter(
    (row) =>
      row &&
      row.some((cell) => cell !== undefined && cell !== null && cell !== '')
  );

  if (nonEmptyRows.length === 0) return null;

  // Format as a simple table
  const lines: string[] = [`Sheet: ${sheetName}`, ''];

  for (const row of nonEmptyRows.slice(0, 500)) {
    // Limit to 500 rows per sheet
    const cells = row.map((cell) => {
      if (cell === undefined || cell === null) return '';
      return String(cell).trim();
    });
    lines.push(cells.join('\t'));
  }

  if (nonEmptyRows.length > 500) {
    lines.push(`... (${nonEmptyRows.length - 500} more rows)`);
  }

  return lines.join('\n');
}

interface RawSpreadsheetParseResult {
  documentType?: string;
  currency?: string;
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

function validateBankStatement(
  raw: RawSpreadsheetParseResult
): SpreadsheetParserOutput {
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
      error: 'No transactions found in spreadsheet',
    };
  }

  const validatedTransactions: ParsedTransactionRow[] = [];
  for (let i = 0; i < raw.transactions.length; i++) {
    const tx = raw.transactions[i];
    if (!tx) continue;

    let amount =
      typeof tx.amount === 'string'
        ? parseFloat(tx.amount.replace(/[,$]/g, ''))
        : tx.amount;
    if (typeof amount !== 'number' || !Number.isFinite(amount)) {
      console.warn(
        `[spreadsheetParser] Skipping transaction ${i}: invalid amount ${tx.amount}`
      );
      continue;
    }

    amount = Math.abs(amount);

    if (amount > 1_000_000_000) {
      console.warn(
        `[spreadsheetParser] Skipping transaction ${i}: amount too large ${amount}`
      );
      continue;
    }

    const description = tx.description?.trim();
    if (!description) {
      console.warn(
        `[spreadsheetParser] Skipping transaction ${i}: missing description`
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
      error: 'No valid transactions could be parsed from spreadsheet',
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

function normalizeDate(dateStr: string | undefined | null): string | null {
  if (!dateStr) {
    return null;
  }

  // Handle Excel serial date numbers
  if (typeof dateStr === 'number' || /^\d+$/.test(dateStr)) {
    const serialDate =
      typeof dateStr === 'number' ? dateStr : parseInt(dateStr, 10);
    // Excel dates start from 1900-01-01 (serial 1) or 1904-01-01 for Mac
    // This is a simplified conversion
    if (serialDate > 1 && serialDate < 100000) {
      const date = new Date((serialDate - 25569) * 86400 * 1000);
      if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0]!;
      }
    }
  }

  const isoMatch = String(dateStr).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  }

  const slashMatch = String(dateStr).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const [, first, second, year] = slashMatch;
    const month = first!.padStart(2, '0');
    const day = second!.padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // DD/MM/YYYY format (common in Latin America)
  const ddmmyyyy = String(dateStr).match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (ddmmyyyy) {
    const [, day, month, year] = ddmmyyyy;
    const fullYear = year!.length === 2 ? `20${year}` : year;
    return `${fullYear}-${month!.padStart(2, '0')}-${day!.padStart(2, '0')}`;
  }

  try {
    const parsed = new Date(String(dateStr));
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString().split('T')[0]!;
    }
  } catch {
    // Fall through
  }

  return null;
}
