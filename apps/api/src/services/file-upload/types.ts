/**
 * Type definitions for file parsing system
 *
 * These types define the canonical JSON structure for parsed documents.
 * All parsers (image, PDF, Excel) must produce data conforming to these types.
 */

// ============================================================================
// Document Types
// ============================================================================

export type DocumentType = 'receipt' | 'invoice' | 'bank_statement' | 'excel_table';

// ============================================================================
// Parsed Transaction Row
// ============================================================================

export interface ParsedTransactionRow {
  /** Unique identifier for this row, e.g. 'row_1', 'row_2', 'main' */
  id: string;
  /** ISO date YYYY-MM-DD, may be null if not parseable */
  date: string | null;
  /** Transaction description/memo */
  description: string;
  /** Amount as decimal number (NOT cents). Positive = credit, negative = debit */
  amount: number;
  /** Whether this is a credit (true) or debit (false) */
  isCredit: boolean;
  /** AI-suggested category, if any */
  categoryGuess?: string | null;
  /** Original raw text from the source row */
  rawRow?: string | null;
}

// ============================================================================
// Parsed Receipt/Invoice
// ============================================================================

export interface ParsedReceipt {
  documentType: 'receipt' | 'invoice';
  /** Currency code: USD, PAB, etc. */
  currency: string;
  mainTransaction: {
    id: 'main';
    /** ISO date YYYY-MM-DD */
    date: string;
    /** Merchant/vendor name */
    merchant: string;
    /** Total amount as decimal (positive for expense) */
    amount: number;
    /** AI-suggested category */
    categoryGuess?: string | null;
    /** Additional notes extracted from receipt */
    notes?: string | null;
  };
}

// ============================================================================
// Parsed Bank Statement
// ============================================================================

export interface ParsedBankStatement {
  documentType: 'bank_statement';
  /** Account name if detected */
  accountName?: string | null;
  /** Statement period */
  period?: {
    from?: string | null;
    to?: string | null;
  };
  /** Currency code */
  currency: string;
  /** List of transactions */
  transactions: ParsedTransactionRow[];
}

// ============================================================================
// Union Type
// ============================================================================

export type ParsedSummary = ParsedReceipt | ParsedBankStatement;

// ============================================================================
// Validation Helpers
// ============================================================================

/**
 * Type guard to check if a parsed summary is a receipt/invoice
 */
export function isReceipt(summary: ParsedSummary): summary is ParsedReceipt {
  return summary.documentType === 'receipt' || summary.documentType === 'invoice';
}

/**
 * Type guard to check if a parsed summary is a bank statement
 */
export function isBankStatement(summary: ParsedSummary): summary is ParsedBankStatement {
  return summary.documentType === 'bank_statement';
}

/**
 * Validates a parsed summary has required fields
 */
export function validateParsedSummary(data: unknown): data is ParsedSummary {
  if (!data || typeof data !== 'object') return false;

  const obj = data as Record<string, unknown>;

  if (!obj.documentType || typeof obj.documentType !== 'string') return false;
  if (!obj.currency || typeof obj.currency !== 'string') return false;

  if (obj.documentType === 'receipt' || obj.documentType === 'invoice') {
    if (!obj.mainTransaction || typeof obj.mainTransaction !== 'object') return false;
    const mt = obj.mainTransaction as Record<string, unknown>;
    if (typeof mt.amount !== 'number' || !Number.isFinite(mt.amount)) return false;
    if (typeof mt.merchant !== 'string') return false;
    if (typeof mt.date !== 'string') return false;
    return true;
  }

  if (obj.documentType === 'bank_statement') {
    if (!Array.isArray(obj.transactions)) return false;
    for (const tx of obj.transactions) {
      if (typeof tx !== 'object' || tx === null) return false;
      const row = tx as Record<string, unknown>;
      if (typeof row.id !== 'string') return false;
      if (typeof row.amount !== 'number' || !Number.isFinite(row.amount)) return false;
      if (typeof row.description !== 'string') return false;
    }
    return true;
  }

  return false;
}

// ============================================================================
// File Upload Configuration
// ============================================================================

export const FILE_UPLOAD_CONFIG = {
  /** Maximum file size in bytes (20MB) */
  maxFileSizeBytes: 20 * 1024 * 1024,

  /** Allowed MIME types for upload */
  allowedMimeTypes: [
    // Images
    'image/png',
    'image/jpeg',
    'image/jpg',
    'image/webp',
    // PDFs
    'application/pdf',
    // Excel
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    // CSV
    'text/csv',
    'application/csv',
  ] as const,

  /** MIME types that are images */
  imageMimeTypes: ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'] as const,

  /** MIME types that are PDFs */
  pdfMimeTypes: ['application/pdf'] as const,

  /** MIME types that are spreadsheets */
  spreadsheetMimeTypes: [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'text/csv',
    'application/csv',
  ] as const,

  /** Current parser version for tracking */
  parserVersion: 'v1',
} as const;

/**
 * Check if a MIME type is allowed
 */
export function isAllowedMimeType(mimeType: string): boolean {
  return FILE_UPLOAD_CONFIG.allowedMimeTypes.includes(
    mimeType as (typeof FILE_UPLOAD_CONFIG.allowedMimeTypes)[number]
  );
}

/**
 * Check if a MIME type is an image
 */
export function isImageMimeType(mimeType: string): boolean {
  return FILE_UPLOAD_CONFIG.imageMimeTypes.includes(
    mimeType as (typeof FILE_UPLOAD_CONFIG.imageMimeTypes)[number]
  );
}

/**
 * Check if a MIME type is a PDF
 */
export function isPdfMimeType(mimeType: string): boolean {
  return FILE_UPLOAD_CONFIG.pdfMimeTypes.includes(
    mimeType as (typeof FILE_UPLOAD_CONFIG.pdfMimeTypes)[number]
  );
}

/**
 * Check if a MIME type is a spreadsheet
 */
export function isSpreadsheetMimeType(mimeType: string): boolean {
  return FILE_UPLOAD_CONFIG.spreadsheetMimeTypes.includes(
    mimeType as (typeof FILE_UPLOAD_CONFIG.spreadsheetMimeTypes)[number]
  );
}
