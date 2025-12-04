import type { Transaction } from './types';

/**
 * CSV parsing utilities for transaction imports
 */

export interface CSVMapping {
  dateColumn: string;
  descriptionColumn: string;
  amountColumn: string;
  accountColumn?: string;
  dateFormat?: string;
}

export interface ParseOptions {
  mapping: CSVMapping;
  skipHeader?: boolean;
  delimiter?: string;
}

/**
 * Parse a simple CSV string into an array of objects
 */
export function parseCSV(
  csvContent: string,
  delimiter: string = ','
): Record<string, string>[] {
  const lines = csvContent.trim().split('\n');
  if (lines.length === 0) {
    return [];
  }

  const headers = lines[0].split(delimiter).map((h) => h.trim());
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(delimiter).map((v) => v.trim());
    const row: Record<string, string> = {};

    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });

    rows.push(row);
  }

  return rows;
}

/**
 * Parse date from various common formats
 */
export function parseDate(dateString: string): Date {
  // Try ISO format first
  const isoDate = new Date(dateString);
  if (!isNaN(isoDate.getTime())) {
    return isoDate;
  }

  // Try MM/DD/YYYY
  const parts = dateString.split(/[/-]/);
  if (parts.length === 3) {
    const [month, day, year] = parts.map(Number);
    return new Date(year, month - 1, day);
  }

  throw new Error(`Unable to parse date: ${dateString}`);
}

/**
 * Parse amount, handling various formats (with/without currency symbols, commas)
 */
export function parseAmount(amountString: string): number {
  // Remove currency symbols and commas
  const cleaned = amountString.replace(/[$,€£¥]/g, '').trim();

  // Handle parentheses for negative numbers
  const isNegative = cleaned.startsWith('(') && cleaned.endsWith(')');
  const number = parseFloat(
    isNegative ? cleaned.slice(1, -1) : cleaned
  );

  if (isNaN(number)) {
    throw new Error(`Unable to parse amount: ${amountString}`);
  }

  return isNegative ? -number : number;
}

/**
 * Convert parsed CSV rows to Transaction objects
 */
export function csvToTransactions(
  csvContent: string,
  options: ParseOptions,
  accountId: string = 'default'
): Transaction[] {
  const rows = parseCSV(csvContent, options.delimiter);
  const transactions: Transaction[] = [];

  for (const [index, row] of rows.entries()) {
    try {
      const date = parseDate(row[options.mapping.dateColumn]);
      const description = row[options.mapping.descriptionColumn] || 'Unknown';
      const amount = parseAmount(row[options.mapping.amountColumn]);
      const account =
        options.mapping.accountColumn
          ? row[options.mapping.accountColumn] || accountId
          : accountId;

      transactions.push({
        id: `csv-${accountId}-${index}`,
        date,
        description,
        amount,
        accountId: account,
      });
    } catch (error) {
      console.warn(`Failed to parse row ${index}:`, error);
      // Skip invalid rows
    }
  }

  return transactions;
}
