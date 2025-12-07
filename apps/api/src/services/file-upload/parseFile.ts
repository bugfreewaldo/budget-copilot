/**
 * Parse File Worker
 *
 * Main orchestrator that coordinates file parsing.
 * Dispatches to the appropriate parser based on MIME type.
 *
 * This module handles:
 * - Loading file from S3/R2
 * - Detecting file type and dispatching to parser
 * - Storing parsed results in the database
 * - Updating file status
 */

import { nanoid } from 'nanoid';
import { getDb, saveDatabase } from '../../db/client.js';
import {
  uploadedFiles,
  fileParsedSummaries,
  type UploadedFile,
} from '../../db/schema.js';
import { eq } from 'drizzle-orm';
import { getFileBuffer, getFileBase64 } from './storage.js';
import {
  isImageMimeType,
  isPdfMimeType,
  isSpreadsheetMimeType,
  FILE_UPLOAD_CONFIG,
  type ParsedSummary,
} from './types.js';
import { parseImageDocument } from './parsers/imageParser.js';
import { parsePdfDocument } from './parsers/pdfParser.js';
import { parseExcelDocument } from './parsers/excelParser.js';

// ============================================================================
// Types
// ============================================================================

export interface ParseFileResult {
  success: true;
  summaryId: string;
  documentType: string;
}

export interface ParseFileError {
  success: false;
  error: string;
}

export type ParseFileOutput = ParseFileResult | ParseFileError;

// Track files currently being parsed to prevent concurrent parsing
const parsingInProgress = new Set<string>();

// ============================================================================
// Main Worker Function
// ============================================================================

/**
 * Parse an uploaded file and store the results.
 *
 * This function:
 * 1. Loads the file from storage
 * 2. Dispatches to the appropriate parser
 * 3. Saves the parsed summary to the database
 * 4. Updates the file status
 *
 * @param fileId - The ID of the uploaded file to parse
 */
export async function parseFile(fileId: string): Promise<ParseFileOutput> {
  // Prevent concurrent parsing of the same file
  if (parsingInProgress.has(fileId)) {
    return {
      success: false,
      error: 'File is already being parsed',
    };
  }

  parsingInProgress.add(fileId);

  try {
    const db = await getDb();

    // Load file metadata
    const file = await db.query.uploadedFiles.findFirst({
      where: eq(uploadedFiles.id, fileId),
    });

    if (!file) {
      return {
        success: false,
        error: 'File not found',
      };
    }

    // Check if already processed
    if (file.status === 'processed') {
      return {
        success: false,
        error: 'File has already been processed',
      };
    }

    // Update status to processing
    await db
      .update(uploadedFiles)
      .set({
        status: 'processing',
        updatedAt: Date.now(),
      })
      .where(eq(uploadedFiles.id, fileId));
    saveDatabase();

    // Parse the file
    const result = await parseFileByType(file);

    if (result.success === false) {
      // Mark as failed - result is narrowed to ParserError here
      const errorMessage = result.error;
      await db
        .update(uploadedFiles)
        .set({
          status: 'failed',
          failureReason: errorMessage.slice(0, 500), // Truncate long errors
          updatedAt: Date.now(),
        })
        .where(eq(uploadedFiles.id, fileId));
      saveDatabase();

      return {
        success: false as const,
        error: errorMessage,
      };
    }

    // Save the parsed summary
    const summaryId = nanoid();
    await db.insert(fileParsedSummaries).values({
      id: summaryId,
      fileId,
      parserVersion: FILE_UPLOAD_CONFIG.parserVersion,
      documentType: result.summary.documentType,
      summaryJson: JSON.stringify(result.summary),
      createdAt: Date.now(),
    });

    // Update file status to processed
    await db
      .update(uploadedFiles)
      .set({
        status: 'processed',
        failureReason: null,
        updatedAt: Date.now(),
      })
      .where(eq(uploadedFiles.id, fileId));
    saveDatabase();

    return {
      success: true,
      summaryId,
      documentType: result.summary.documentType,
    };
  } catch (error) {
    // Handle unexpected errors
    const db = await getDb();
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error during parsing';

    await db
      .update(uploadedFiles)
      .set({
        status: 'failed',
        failureReason: errorMessage.slice(0, 500),
        updatedAt: Date.now(),
      })
      .where(eq(uploadedFiles.id, fileId));
    saveDatabase();

    console.error(`[parseFile] Error parsing file ${fileId}:`, error);

    return {
      success: false,
      error: errorMessage,
    };
  } finally {
    parsingInProgress.delete(fileId);
  }
}

// ============================================================================
// Parser Dispatch
// ============================================================================

interface ParserResult {
  success: true;
  summary: ParsedSummary;
}

interface ParserError {
  success: false;
  error: string;
}

type ParserOutput = ParserResult | ParserError;

/**
 * Dispatch to the appropriate parser based on MIME type
 */
async function parseFileByType(file: UploadedFile): Promise<ParserOutput> {
  const { mimeType, storageKey, filename } = file;

  if (isImageMimeType(mimeType)) {
    // Image files - use vision model
    const base64 = await getFileBase64(storageKey);
    return parseImageDocument(base64, { mimeType, filename });
  }

  if (isPdfMimeType(mimeType)) {
    // PDF files - extract text and use text model
    const buffer = await getFileBuffer(storageKey);
    return parsePdfDocument(buffer, { mimeType, filename });
  }

  if (isSpreadsheetMimeType(mimeType)) {
    // Excel/CSV files - use column heuristics
    const buffer = await getFileBuffer(storageKey);
    return parseExcelDocument(buffer, { mimeType, filename });
  }

  return {
    success: false,
    error: `Unsupported MIME type: ${mimeType}`,
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Re-parse a file with a new parser version.
 * Creates a new summary without deleting the old one.
 */
export async function reparseFile(fileId: string): Promise<ParseFileOutput> {
  const db = await getDb();

  // Reset the file status to stored
  await db
    .update(uploadedFiles)
    .set({
      status: 'stored',
      failureReason: null,
      updatedAt: Date.now(),
    })
    .where(eq(uploadedFiles.id, fileId));
  saveDatabase();

  // Re-parse
  return parseFile(fileId);
}

/**
 * Check if a file is currently being parsed
 */
export function isFileBeingParsed(fileId: string): boolean {
  return parsingInProgress.has(fileId);
}
