/**
 * Files Routes
 *
 * API routes for file management:
 * - GET /v1/files - List user's uploaded files
 * - GET /v1/files/:fileId/summary - Get parsed summary
 * - POST /v1/files/:fileId/import - Import parsed items as transactions
 */

import type { FastifyPluginAsync } from 'fastify';
import { getDb, saveDatabase } from '../../db/client.js';
import { requireAuth } from '../plugins/auth.js';
import { createErrorResponse, formatZodError } from '../schemas/common.js';
import { fileIdSchema, importItemsSchema } from '../schemas/files.js';
import * as filesRepo from '../lib/repo/files.js';
import {
  type ParsedSummary,
  type ParsedBankStatement,
  type ParsedReceipt,
  isReceipt,
  isBankStatement,
} from '../../services/file-upload/types.js';

/**
 * Files routes plugin
 */
export const filesRoutes: FastifyPluginAsync = async (fastify) => {
  // ============================================================================
  // GET /v1/files
  // ============================================================================

  fastify.get('/files', { preHandler: requireAuth }, async (request, reply) => {
    try {
      const userId = request.user!.id;
      const db = await getDb();

      const files = await filesRepo.findUploadedFilesByUser(db, userId);

      return reply.status(200).send({
        data: files.map((f) => ({
          id: f.id,
          filename: f.filename,
          mimeType: f.mimeType,
          sizeBytes: f.sizeBytes,
          status: f.status,
          createdAt: f.createdAt,
        })),
      });
    } catch (error) {
      request.log.error({ error }, 'Failed to list files');
      return reply.status(500).send(
        createErrorResponse('DB_ERROR', 'Failed to retrieve files')
      );
    }
  });

  // ============================================================================
  // GET /v1/files/:fileId/summary
  // ============================================================================

  fastify.get<{ Params: { fileId: string } }>(
    '/files/:fileId/summary',
    { preHandler: requireAuth },
    async (request, reply) => {
      try {
        // Validate file ID
        const idValidation = fileIdSchema.safeParse(request.params.fileId);
        if (!idValidation.success) {
          return reply.status(400).send(formatZodError(idValidation.error));
        }

        const fileId = idValidation.data;
        const userId = request.user!.id;
        const db = await getDb();

        // Find file and verify ownership
        // Return 404 for both not found and wrong owner (don't leak existence)
        const file = await filesRepo.findUploadedFileByIdAndUser(
          db,
          fileId,
          userId
        );

        if (!file) {
          return reply.status(404).send(
            createErrorResponse('NOT_FOUND', 'File not found')
          );
        }

        // Check file status
        if (file.status === 'processing') {
          return reply.status(404).send(
            createErrorResponse(
              'PROCESSING',
              'File is still being processed. Please try again later.'
            )
          );
        }

        if (file.status === 'failed') {
          return reply.status(404).send(
            createErrorResponse(
              'PROCESSING_FAILED',
              'File processing failed. Please try uploading again.'
            )
          );
        }

        if (file.status === 'stored') {
          return reply.status(404).send(
            createErrorResponse(
              'NOT_PROCESSED',
              'File has not been processed yet.'
            )
          );
        }

        // Get the latest summary
        const summary = await filesRepo.getLatestSummaryForFile(db, fileId);

        if (!summary) {
          return reply.status(404).send(
            createErrorResponse('NOT_FOUND', 'No parsed summary available')
          );
        }

        // Parse the JSON safely
        let parsedSummary: ParsedSummary;
        try {
          parsedSummary = JSON.parse(summary.summaryJson);
        } catch {
          request.log.error({ fileId }, 'Corrupted summary JSON');
          return reply.status(500).send(
            createErrorResponse('DATA_ERROR', 'Summary data is corrupted')
          );
        }

        // Get already imported items
        const importedItems = await filesRepo.getImportedItemsForFile(
          db,
          fileId
        );
        const importedItemIds = new Set(importedItems.map((i) => i.parsedItemId));

        return reply.status(200).send({
          documentType: summary.documentType,
          parserVersion: summary.parserVersion,
          summary: parsedSummary,
          importedItemIds: Array.from(importedItemIds),
        });
      } catch (error) {
        request.log.error({ error }, 'Failed to get file summary');
        return reply.status(500).send(
          createErrorResponse('DB_ERROR', 'Failed to retrieve file summary')
        );
      }
    }
  );

  // ============================================================================
  // POST /v1/files/:fileId/import
  // ============================================================================

  fastify.post<{ Params: { fileId: string } }>(
    '/files/:fileId/import',
    { preHandler: requireAuth },
    async (request, reply) => {
      try {
        // Validate file ID
        const idValidation = fileIdSchema.safeParse(request.params.fileId);
        if (!idValidation.success) {
          return reply.status(400).send(formatZodError(idValidation.error));
        }

        // Validate request body
        const bodyValidation = importItemsSchema.safeParse(request.body);
        if (!bodyValidation.success) {
          return reply.status(400).send(formatZodError(bodyValidation.error));
        }

        const fileId = idValidation.data;
        const { items, defaultType, accountId } = bodyValidation.data;
        const userId = request.user!.id;
        const db = await getDb();

        // Find file and verify ownership
        const file = await filesRepo.findUploadedFileByIdAndUser(
          db,
          fileId,
          userId
        );

        if (!file) {
          return reply.status(404).send(
            createErrorResponse('NOT_FOUND', 'File not found')
          );
        }

        if (file.status !== 'processed') {
          return reply.status(400).send(
            createErrorResponse(
              'NOT_PROCESSED',
              'File must be successfully processed before importing'
            )
          );
        }

        // Get the summary
        const summary = await filesRepo.getLatestSummaryForFile(db, fileId);
        if (!summary) {
          return reply.status(404).send(
            createErrorResponse('NOT_FOUND', 'No parsed summary available')
          );
        }

        // Parse the summary
        let parsedSummary: ParsedSummary;
        try {
          parsedSummary = JSON.parse(summary.summaryJson);
        } catch {
          return reply.status(500).send(
            createErrorResponse('DATA_ERROR', 'Summary data is corrupted')
          );
        }

        // Import the requested items
        const importedTransactions: string[] = [];
        const skippedItems: string[] = [];
        const errors: Array<{ itemId: string; error: string }> = [];

        for (const importItem of items) {
          const { id: itemId, categoryId } = importItem;

          // Check if already imported
          const alreadyImported = await filesRepo.isItemImported(
            db,
            fileId,
            itemId
          );
          if (alreadyImported) {
            skippedItems.push(itemId);
            continue;
          }

          // Find the item in the summary
          const item = findItemInSummary(parsedSummary, itemId);
          if (!item) {
            errors.push({ itemId, error: 'Item not found in summary' });
            continue;
          }

          // Validate the item data
          if (!Number.isFinite(item.amount)) {
            errors.push({ itemId, error: 'Invalid amount' });
            continue;
          }

          // Determine transaction type
          let txType: 'income' | 'expense';
          if (item.isCredit !== undefined) {
            txType = item.isCredit ? 'income' : 'expense';
          } else if (defaultType === 'income' || defaultType === 'expense') {
            txType = defaultType;
          } else {
            txType = item.amount > 0 ? 'income' : 'expense';
          }

          // Convert amount to cents
          const amountCents = Math.round(Math.abs(item.amount) * 100);

          // For expenses, amount should be negative in our system
          const finalAmountCents = txType === 'expense' ? -amountCents : amountCents;

          // Use the parsed date from the document, fall back to period start or today
          const periodFrom = isBankStatement(parsedSummary) ? parsedSummary.period?.from : null;
          const date = item.date || periodFrom || new Date().toISOString().split('T')[0];

          try {
            const result = await filesRepo.importParsedItemAsTransaction(db, {
              userId,
              fileId,
              parsedItemId: itemId,
              date,
              description: item.description,
              amountCents: finalAmountCents,
              type: txType,
              categoryId,
              accountId,
            });

            importedTransactions.push(result.transactionId);
          } catch (err) {
            request.log.error({ err, itemId }, 'Failed to import item');
            errors.push({
              itemId,
              error: err instanceof Error ? err.message : 'Import failed',
            });
          }
        }

        saveDatabase();

        request.log.info(
          {
            fileId,
            imported: importedTransactions.length,
            skipped: skippedItems.length,
            errors: errors.length,
          },
          'Import completed'
        );

        return reply.status(200).send({
          ok: true,
          imported: importedTransactions,
          skipped: skippedItems,
          errors,
        });
      } catch (error) {
        request.log.error({ error }, 'Failed to import items');
        return reply.status(500).send(
          createErrorResponse('IMPORT_ERROR', 'Failed to import items')
        );
      }
    }
  );
};

// ============================================================================
// Helpers
// ============================================================================

interface NormalizedItem {
  id: string;
  date: string | null;
  description: string;
  amount: number;
  isCredit?: boolean;
}

/**
 * Find an item in a parsed summary by ID
 */
function findItemInSummary(
  summary: ParsedSummary,
  itemId: string
): NormalizedItem | null {
  if (isReceipt(summary)) {
    if (itemId === 'main') {
      return {
        id: 'main',
        date: summary.mainTransaction.date,
        description: summary.mainTransaction.merchant,
        amount: summary.mainTransaction.amount,
        isCredit: false, // Receipts are expenses
      };
    }
    return null;
  }

  if (isBankStatement(summary)) {
    const tx = summary.transactions.find((t) => t.id === itemId);
    if (tx) {
      return {
        id: tx.id,
        date: tx.date,
        description: tx.description,
        amount: tx.amount,
        isCredit: tx.isCredit,
      };
    }
    return null;
  }

  return null;
}
