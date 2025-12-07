/**
 * Parse File Worker
 *
 * Main orchestrator that coordinates file parsing.
 */

import { nanoid } from 'nanoid';
import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import {
  uploadedFiles,
  fileParsedSummaries,
  type UploadedFile,
} from '@/lib/db/schema';
import { getFileBase64 } from './storage';
import {
  isImageMimeType,
  FILE_UPLOAD_CONFIG,
  type ParsedSummary,
} from './types';
import { parseImageDocument } from './imageParser';

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

const parsingInProgress = new Set<string>();

export async function parseFile(fileId: string): Promise<ParseFileOutput> {
  if (parsingInProgress.has(fileId)) {
    return {
      success: false,
      error: 'File is already being parsed',
    };
  }

  parsingInProgress.add(fileId);

  try {
    const db = getDb();

    const file = await db.query.uploadedFiles.findFirst({
      where: eq(uploadedFiles.id, fileId),
    });

    if (!file) {
      return {
        success: false,
        error: 'File not found',
      };
    }

    if (file.status === 'processed') {
      return {
        success: false,
        error: 'File has already been processed',
      };
    }

    await db
      .update(uploadedFiles)
      .set({
        status: 'processing',
        updatedAt: Date.now(),
      })
      .where(eq(uploadedFiles.id, fileId));

    const result = await parseFileByType(file);

    if (result.success === false) {
      const errorMessage = result.error;
      await db
        .update(uploadedFiles)
        .set({
          status: 'failed',
          failureReason: errorMessage.slice(0, 500),
          updatedAt: Date.now(),
        })
        .where(eq(uploadedFiles.id, fileId));

      return {
        success: false as const,
        error: errorMessage,
      };
    }

    const summaryId = nanoid();
    await db.insert(fileParsedSummaries).values({
      id: summaryId,
      fileId,
      parserVersion: FILE_UPLOAD_CONFIG.parserVersion,
      documentType: result.summary.documentType,
      summaryJson: JSON.stringify(result.summary),
      createdAt: Date.now(),
    });

    await db
      .update(uploadedFiles)
      .set({
        status: 'processed',
        failureReason: null,
        updatedAt: Date.now(),
      })
      .where(eq(uploadedFiles.id, fileId));

    return {
      success: true,
      summaryId,
      documentType: result.summary.documentType,
    };
  } catch (error) {
    const db = getDb();
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

    console.error(`[parseFile] Error parsing file ${fileId}:`, error);

    return {
      success: false,
      error: errorMessage,
    };
  } finally {
    parsingInProgress.delete(fileId);
  }
}

interface ParserResult {
  success: true;
  summary: ParsedSummary;
}

interface ParserError {
  success: false;
  error: string;
}

type ParserOutput = ParserResult | ParserError;

async function parseFileByType(file: UploadedFile): Promise<ParserOutput> {
  const { mimeType, storageKey, filename } = file;

  if (isImageMimeType(mimeType)) {
    const base64 = await getFileBase64(storageKey);
    return parseImageDocument(base64, { mimeType, filename });
  }

  // PDF and Excel parsers can be added here in the future
  return {
    success: false,
    error: `Unsupported MIME type: ${mimeType}. Currently only images are supported.`,
  };
}

export function isFileBeingParsed(fileId: string): boolean {
  return parsingInProgress.has(fileId);
}
