/**
 * Files Repository
 *
 * Database operations for uploaded files, parsed summaries, and imported items.
 */

import { eq, and, desc } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import type { DatabaseInstance } from '../../../db/client.js';
import {
  uploadedFiles,
  fileParsedSummaries,
  fileImportedItems,
  transactions,
  type UploadedFile,
  type NewUploadedFile,
  type FileParsedSummary,
  type FileImportedItem,
} from '../../../db/schema.js';

// ============================================================================
// Uploaded Files
// ============================================================================

/**
 * Create a new uploaded file record
 */
export async function createUploadedFile(
  db: DatabaseInstance,
  data: Omit<NewUploadedFile, 'id' | 'createdAt' | 'updatedAt'>
): Promise<UploadedFile> {
  const now = Date.now();
  const record: NewUploadedFile = {
    ...data,
    id: nanoid(),
    createdAt: now,
    updatedAt: now,
  };

  await db.insert(uploadedFiles).values(record);

  return record as UploadedFile;
}

/**
 * Create multiple uploaded file records
 */
export async function createUploadedFiles(
  db: DatabaseInstance,
  files: Array<Omit<NewUploadedFile, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<UploadedFile[]> {
  const now = Date.now();
  const records: NewUploadedFile[] = files.map((data) => ({
    ...data,
    id: nanoid(),
    createdAt: now,
    updatedAt: now,
  }));

  await db.insert(uploadedFiles).values(records);

  return records as UploadedFile[];
}

/**
 * Find an uploaded file by ID
 */
export async function findUploadedFileById(
  db: DatabaseInstance,
  id: string
): Promise<UploadedFile | undefined> {
  const result = await db.query.uploadedFiles.findFirst({
    where: eq(uploadedFiles.id, id),
  });
  return result;
}

/**
 * Find an uploaded file by ID, ensuring user ownership
 */
export async function findUploadedFileByIdAndUser(
  db: DatabaseInstance,
  id: string,
  userId: string
): Promise<UploadedFile | undefined> {
  const result = await db.query.uploadedFiles.findFirst({
    where: and(eq(uploadedFiles.id, id), eq(uploadedFiles.userId, userId)),
  });
  return result;
}

/**
 * Find all uploaded files for a user
 */
export async function findUploadedFilesByUser(
  db: DatabaseInstance,
  userId: string
): Promise<UploadedFile[]> {
  const results = await db.query.uploadedFiles.findMany({
    where: eq(uploadedFiles.userId, userId),
    orderBy: [desc(uploadedFiles.createdAt)],
  });
  return results;
}

/**
 * Update file status
 */
export async function updateFileStatus(
  db: DatabaseInstance,
  id: string,
  status: UploadedFile['status'],
  failureReason?: string | null
): Promise<void> {
  await db
    .update(uploadedFiles)
    .set({
      status,
      failureReason: failureReason ?? null,
      updatedAt: Date.now(),
    })
    .where(eq(uploadedFiles.id, id));
}

// ============================================================================
// Parsed Summaries
// ============================================================================

/**
 * Get the latest parsed summary for a file
 */
export async function getLatestSummaryForFile(
  db: DatabaseInstance,
  fileId: string
): Promise<FileParsedSummary | undefined> {
  const result = await db.query.fileParsedSummaries.findFirst({
    where: eq(fileParsedSummaries.fileId, fileId),
    orderBy: [desc(fileParsedSummaries.createdAt)],
  });
  return result;
}

/**
 * Get all parsed summaries for a file (for version history)
 */
export async function getSummariesForFile(
  db: DatabaseInstance,
  fileId: string
): Promise<FileParsedSummary[]> {
  const results = await db.query.fileParsedSummaries.findMany({
    where: eq(fileParsedSummaries.fileId, fileId),
    orderBy: [desc(fileParsedSummaries.createdAt)],
  });
  return results;
}

// ============================================================================
// Imported Items
// ============================================================================

/**
 * Check if a parsed item has already been imported
 */
export async function isItemImported(
  db: DatabaseInstance,
  fileId: string,
  parsedItemId: string
): Promise<boolean> {
  const result = await db.query.fileImportedItems.findFirst({
    where: and(
      eq(fileImportedItems.fileId, fileId),
      eq(fileImportedItems.parsedItemId, parsedItemId)
    ),
  });
  return !!result;
}

/**
 * Get all imported items for a file
 */
export async function getImportedItemsForFile(
  db: DatabaseInstance,
  fileId: string
): Promise<FileImportedItem[]> {
  const results = await db.query.fileImportedItems.findMany({
    where: eq(fileImportedItems.fileId, fileId),
  });
  return results;
}

/**
 * Create an imported item record
 */
export async function createImportedItem(
  db: DatabaseInstance,
  data: { fileId: string; parsedItemId: string; transactionId: string }
): Promise<FileImportedItem> {
  const record = {
    id: nanoid(),
    ...data,
    createdAt: Date.now(),
  };

  await db.insert(fileImportedItems).values(record);

  return record as FileImportedItem;
}

// ============================================================================
// Import Transaction from Parsed Data
// ============================================================================

export interface ImportTransactionInput {
  userId: string;
  fileId: string;
  parsedItemId: string;
  date: string;
  description: string;
  amountCents: number;
  type: 'income' | 'expense';
  categoryId?: string | null;
  accountId: string;
}

/**
 * Import a parsed item as a transaction
 * Creates both the transaction and the import tracking record
 */
export async function importParsedItemAsTransaction(
  db: DatabaseInstance,
  input: ImportTransactionInput
): Promise<{ transactionId: string; importId: string }> {
  const transactionId = nanoid();
  const importId = nanoid();
  const now = Date.now();

  // Create the transaction
  await db.insert(transactions).values({
    id: transactionId,
    userId: input.userId,
    date: input.date,
    description: input.description,
    amountCents: input.amountCents,
    type: input.type,
    categoryId: input.categoryId ?? null,
    accountId: input.accountId,
    cleared: false,
    createdAt: now,
    updatedAt: now,
  });

  // Create the import tracking record
  await db.insert(fileImportedItems).values({
    id: importId,
    fileId: input.fileId,
    parsedItemId: input.parsedItemId,
    transactionId,
    createdAt: now,
  });

  return { transactionId, importId };
}

// ============================================================================
// Batch Operations
// ============================================================================

/**
 * Get files pending processing
 */
export async function getFilesPendingProcessing(
  db: DatabaseInstance,
  userId?: string
): Promise<UploadedFile[]> {
  if (userId) {
    return db.query.uploadedFiles.findMany({
      where: and(
        eq(uploadedFiles.userId, userId),
        eq(uploadedFiles.status, 'stored')
      ),
      orderBy: [uploadedFiles.createdAt],
    });
  }

  return db.query.uploadedFiles.findMany({
    where: eq(uploadedFiles.status, 'stored'),
    orderBy: [uploadedFiles.createdAt],
  });
}
