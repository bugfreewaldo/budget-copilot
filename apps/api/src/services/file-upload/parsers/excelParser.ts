/**
 * Excel/CSV Parser
 *
 * Extracts transaction data from Excel (XLSX) and CSV files.
 * Uses heuristic column mapping to identify date, description, and amount columns.
 *
 * This parser does NOT use LLM - it relies on column name heuristics.
 * Future enhancement: Allow users to manually map columns via UI.
 */

import * as XLSX from 'xlsx';
import type { ParsedBankStatement, ParsedTransactionRow } from '../types.js';
import type { UploadedFile } from '../../../db/schema.js';

// ============================================================================
// Column Mapping Heuristics
// ============================================================================

const DATE_COLUMN_NAMES = [
  'date',
  'fecha',
  'transaction date',
  'posting date',
  'trans date',
  'value date',
  'fecha transaccion',
  'fecha de transacción',
  'trans_date',
  'txn_date',
  'posted',
];

const DESCRIPTION_COLUMN_NAMES = [
  'description',
  'descripcion',
  'descripción',
  'memo',
  'details',
  'narrative',
  'concepto',
  'merchant',
  'name',
  'payee',
  'trans_description',
  'transaction description',
  'detalle',
];

const AMOUNT_COLUMN_NAMES = [
  'amount',
  'monto',
  'importe',
  'value',
  'transaction amount',
  'sum',
  'total',
  'amt',
  'debit/credit',
  'amount (usd)',
  'amount (balboas)',
];

const DEBIT_COLUMN_NAMES = [
  'debit',
  'debito',
  'débito',
  'withdrawal',
  'retiro',
  'charge',
  'cargo',
  'out',
  'expense',
];

const CREDIT_COLUMN_NAMES = [
  'credit',
  'credito',
  'crédito',
  'deposit',
  'deposito',
  'depósito',
  'in',
  'income',
  'payment',
];

// ============================================================================
// Parser Implementation
// ============================================================================

export interface ExcelParserResult {
  success: true;
  summary: ParsedBankStatement;
}

export interface ExcelParserError {
  success: false;
  error: string;
}

export type ExcelParserOutput = ExcelParserResult | ExcelParserError;

/**
 * Parse an Excel or CSV file to extract transactions
 */
export async function parseExcelDocument(
  fileBuffer: Buffer,
  file: Pick<UploadedFile, 'mimeType' | 'filename'>
): Promise<ExcelParserOutput> {
  try {
    // Read the workbook
    const workbook = XLSX.read(fileBuffer, {
      type: 'buffer',
      cellDates: true, // Parse dates as Date objects
    });

    // Get the first sheet
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      return {
        success: false,
        error: 'Workbook contains no sheets',
      };
    }

    const sheet = workbook.Sheets[sheetName];
    if (!sheet) {
      return {
        success: false,
        error: 'Could not read first sheet',
      };
    }

    // Convert to JSON rows
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      raw: false, // Convert all values to strings
      defval: '', // Default value for empty cells
    });

    if (rows.length === 0) {
      return {
        success: false,
        error: 'Sheet contains no data rows',
      };
    }

    // Detect column mappings from headers
    const headers = Object.keys(rows[0]);
    const mapping = detectColumnMapping(headers);

    if (!mapping.amount && !mapping.debit && !mapping.credit) {
      return {
        success: false,
        error: `Could not detect amount column. Found headers: ${headers.join(', ')}`,
      };
    }

    // Parse rows into transactions
    const transactions: ParsedTransactionRow[] = [];
    const MAX_ROWS = 5000; // Limit for performance

    for (let i = 0; i < Math.min(rows.length, MAX_ROWS); i++) {
      const row = rows[i];
      const tx = parseRow(row, mapping, i + 1);

      if (tx) {
        transactions.push(tx);
      }
    }

    // Detect currency from filename or default to USD
    const currency = detectCurrency(file.filename) || 'USD';

    const summary: ParsedBankStatement = {
      documentType: 'bank_statement',
      accountName: sheetName !== 'Sheet1' ? sheetName : null,
      currency,
      transactions,
    };

    return { success: true, summary };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error parsing Excel/CSV',
    };
  }
}

// ============================================================================
// Column Detection
// ============================================================================

interface ColumnMapping {
  date?: string;
  description?: string;
  amount?: string;
  debit?: string;
  credit?: string;
}

function detectColumnMapping(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {};

  for (const header of headers) {
    const normalized = header.toLowerCase().trim();

    // Check for date column
    if (!mapping.date && DATE_COLUMN_NAMES.some((n) => normalized.includes(n))) {
      mapping.date = header;
      continue;
    }

    // Check for description column
    if (
      !mapping.description &&
      DESCRIPTION_COLUMN_NAMES.some((n) => normalized.includes(n))
    ) {
      mapping.description = header;
      continue;
    }

    // Check for combined amount column
    if (!mapping.amount && AMOUNT_COLUMN_NAMES.some((n) => normalized.includes(n))) {
      mapping.amount = header;
      continue;
    }

    // Check for debit column
    if (!mapping.debit && DEBIT_COLUMN_NAMES.some((n) => normalized.includes(n))) {
      mapping.debit = header;
      continue;
    }

    // Check for credit column
    if (!mapping.credit && CREDIT_COLUMN_NAMES.some((n) => normalized.includes(n))) {
      mapping.credit = header;
      continue;
    }
  }

  // Fallback: If no description column found, use the first text-heavy column
  if (!mapping.description) {
    for (const header of headers) {
      if (header !== mapping.date && header !== mapping.amount) {
        mapping.description = header;
        break;
      }
    }
  }

  return mapping;
}

// ============================================================================
// Row Parsing
// ============================================================================

function parseRow(
  row: Record<string, unknown>,
  mapping: ColumnMapping,
  rowIndex: number
): ParsedTransactionRow | null {
  // Parse amount
  let amount: number;
  let isCredit: boolean;

  if (mapping.debit && mapping.credit) {
    // Separate debit/credit columns
    const debitVal = parseAmount(row[mapping.debit]);
    const creditVal = parseAmount(row[mapping.credit]);

    if (creditVal !== null && creditVal !== 0) {
      amount = creditVal;
      isCredit = true;
    } else if (debitVal !== null && debitVal !== 0) {
      amount = -Math.abs(debitVal); // Debits are negative
      isCredit = false;
    } else {
      return null; // Skip rows with no amount
    }
  } else if (mapping.amount) {
    // Combined amount column
    const val = parseAmount(row[mapping.amount]);
    if (val === null) return null;

    amount = val;
    isCredit = val > 0;
  } else {
    return null;
  }

  // Skip zero amounts
  if (amount === 0) return null;

  // Reject absurdly large amounts
  if (Math.abs(amount) > 1_000_000_000) return null;

  // Parse date
  const date = mapping.date ? parseDate(row[mapping.date]) : null;

  // Parse description
  const description = mapping.description
    ? String(row[mapping.description] || '').trim()
    : 'Unknown transaction';

  // Build raw row string for debugging
  const rawRow = Object.values(row)
    .map((v) => String(v || ''))
    .join(' | ')
    .slice(0, 200);

  return {
    id: `row_${rowIndex}`,
    date,
    description: description || 'Unknown transaction',
    amount,
    isCredit,
    rawRow,
  };
}

// ============================================================================
// Value Parsing Helpers
// ============================================================================

function parseAmount(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;

  let str = String(value).trim();

  // Remove currency symbols and thousands separators
  str = str
    .replace(/[$€£¥B\/\.]/g, '') // Currency symbols
    .replace(/,(?=\d{3})/g, '') // Thousands separators (comma before 3 digits)
    .replace(/\s/g, ''); // Whitespace

  // Handle parentheses as negative (accounting format)
  const isNegative = str.startsWith('(') && str.endsWith(')');
  if (isNegative) {
    str = str.slice(1, -1);
  }

  // Handle explicit negative sign
  const hasMinusSign = str.startsWith('-');
  if (hasMinusSign) {
    str = str.slice(1);
  }

  // Parse the number
  const num = parseFloat(str);
  if (!Number.isFinite(num)) return null;

  return isNegative || hasMinusSign ? -num : num;
}

function parseDate(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;

  // If it's already a Date object (from XLSX)
  if (value instanceof Date) {
    if (isNaN(value.getTime())) return null;
    return value.toISOString().split('T')[0];
  }

  const str = String(value).trim();

  // Try ISO format
  const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  }

  // Try MM/DD/YYYY
  const slashMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const [, month, day, year] = slashMatch;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  // Try DD/MM/YYYY (common in Latin America)
  const latinMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (latinMatch) {
    const [, day, month, year] = latinMatch;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  // Try parsing with Date constructor
  try {
    const parsed = new Date(str);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString().split('T')[0];
    }
  } catch {
    // Fall through
  }

  return null;
}

function detectCurrency(filename: string): string | null {
  const lower = filename.toLowerCase();

  if (lower.includes('usd') || lower.includes('dollar')) return 'USD';
  if (lower.includes('pab') || lower.includes('balboa')) return 'PAB';
  if (lower.includes('eur') || lower.includes('euro')) return 'EUR';

  return null;
}
