/**
 * Type definitions for file parsing system
 */

export type DocumentType =
  | 'receipt'
  | 'invoice'
  | 'bank_statement'
  | 'excel_table';

export interface ParsedTransactionRow {
  id: string;
  date: string | null;
  description: string;
  amount: number;
  isCredit: boolean;
  categoryGuess?: string | null;
  rawRow?: string | null;
}

export interface ParsedReceipt {
  documentType: 'receipt' | 'invoice';
  currency: string;
  mainTransaction: {
    id: 'main';
    date: string;
    merchant: string;
    amount: number;
    categoryGuess?: string | null;
    notes?: string | null;
  };
}

export interface ParsedBankStatement {
  documentType: 'bank_statement';
  accountName?: string | null;
  period?: {
    from?: string | null;
    to?: string | null;
  };
  currency: string;
  transactions: ParsedTransactionRow[];
}

export type ParsedSummary = ParsedReceipt | ParsedBankStatement;

export function isReceipt(summary: ParsedSummary): summary is ParsedReceipt {
  return (
    summary.documentType === 'receipt' || summary.documentType === 'invoice'
  );
}

export function isBankStatement(
  summary: ParsedSummary
): summary is ParsedBankStatement {
  return summary.documentType === 'bank_statement';
}

export const FILE_UPLOAD_CONFIG = {
  maxFileSizeBytes: 20 * 1024 * 1024,
  allowedMimeTypes: [
    'image/png',
    'image/jpeg',
    'image/jpg',
    'image/webp',
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'text/csv',
    'application/csv',
  ] as const,
  imageMimeTypes: [
    'image/png',
    'image/jpeg',
    'image/jpg',
    'image/webp',
  ] as const,
  pdfMimeTypes: ['application/pdf'] as const,
  spreadsheetMimeTypes: [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'text/csv',
    'application/csv',
  ] as const,
  parserVersion: 'v1',
} as const;

export function isAllowedMimeType(mimeType: string): boolean {
  return FILE_UPLOAD_CONFIG.allowedMimeTypes.includes(
    mimeType as (typeof FILE_UPLOAD_CONFIG.allowedMimeTypes)[number]
  );
}

export function isImageMimeType(mimeType: string): boolean {
  return FILE_UPLOAD_CONFIG.imageMimeTypes.includes(
    mimeType as (typeof FILE_UPLOAD_CONFIG.imageMimeTypes)[number]
  );
}

export function isPdfMimeType(mimeType: string): boolean {
  return FILE_UPLOAD_CONFIG.pdfMimeTypes.includes(
    mimeType as (typeof FILE_UPLOAD_CONFIG.pdfMimeTypes)[number]
  );
}

export function isSpreadsheetMimeType(mimeType: string): boolean {
  return FILE_UPLOAD_CONFIG.spreadsheetMimeTypes.includes(
    mimeType as (typeof FILE_UPLOAD_CONFIG.spreadsheetMimeTypes)[number]
  );
}
