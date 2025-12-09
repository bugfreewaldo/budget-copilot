import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { eq, and, desc } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { getAuthenticatedUser } from '@/lib/api/auth';
import { errorJson, json, formatZodError } from '@/lib/api/utils';
import { getDb } from '@/lib/db/client';
import {
  uploadedFiles,
  fileParsedSummaries,
  fileImportedItems,
  transactions,
} from '@/lib/db/schema';
import {
  type ParsedSummary,
  isReceipt,
  isBankStatement,
} from '@/lib/file-upload/types';

export const dynamic = 'force-dynamic';

const importItemSchema = z.object({
  id: z.string().min(1),
  categoryId: z.string().optional(),
});

const importBodySchema = z.object({
  items: z.array(importItemSchema).min(1),
  defaultType: z.enum(['income', 'expense']).optional(),
  accountId: z.string().min(1),
});

interface NormalizedItem {
  id: string;
  date: string | null;
  description: string;
  amount: number;
  isCredit?: boolean;
}

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
        isCredit: false,
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

/**
 * POST /api/v1/files/:fileId/import - Import parsed items as transactions
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ fileId: string }> }
) {
  try {
    const auth = await getAuthenticatedUser(request);
    if (!auth.success) return auth.response;

    const { fileId } = await params;

    if (!fileId || fileId.length < 5 || fileId.length > 30) {
      return errorJson('VALIDATION_ERROR', 'Invalid file ID', 400);
    }

    const body = await request.json();
    const validation = importBodySchema.safeParse(body);

    if (!validation.success) {
      return json(formatZodError(validation.error), 400);
    }

    const { items, defaultType, accountId } = validation.data;
    const db = getDb();

    // Find file and verify ownership
    const file = await db.query.uploadedFiles.findFirst({
      where: and(
        eq(uploadedFiles.id, fileId),
        eq(uploadedFiles.userId, auth.user.id)
      ),
    });

    if (!file) {
      return errorJson('NOT_FOUND', 'File not found', 404);
    }

    if (file.status !== 'processed') {
      return errorJson(
        'INVALID_STATE',
        'File must be successfully processed before importing',
        400
      );
    }

    // Get the summary
    const summary = await db.query.fileParsedSummaries.findFirst({
      where: eq(fileParsedSummaries.fileId, fileId),
      orderBy: desc(fileParsedSummaries.createdAt),
    });

    if (!summary) {
      return errorJson('NOT_FOUND', 'No parsed summary available', 404);
    }

    // Parse the summary JSON
    let parsedSummary: ParsedSummary;
    try {
      parsedSummary = JSON.parse(summary.summaryJson);
    } catch {
      return errorJson('INTERNAL_ERROR', 'Summary data is corrupted', 500);
    }

    // Import the requested items
    const importedTransactions: string[] = [];
    const skippedItems: string[] = [];
    const errors: Array<{ itemId: string; error: string }> = [];

    for (const importItem of items) {
      const { id: itemId, categoryId } = importItem;

      // Check if already imported
      const alreadyImported = await db.query.fileImportedItems.findFirst({
        where: and(
          eq(fileImportedItems.fileId, fileId),
          eq(fileImportedItems.parsedItemId, itemId)
        ),
      });

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
      const finalAmountCents =
        txType === 'expense' ? -amountCents : amountCents;

      // Use the parsed date from the document, fall back to period start or today
      const periodFrom = isBankStatement(parsedSummary)
        ? parsedSummary.period?.from
        : null;
      const date: string =
        item.date || periodFrom || new Date().toISOString().split('T')[0]!;

      try {
        const transactionId = nanoid();
        const importId = nanoid();
        const now = Date.now();

        // Create the transaction
        await db.insert(transactions).values({
          id: transactionId,
          userId: auth.user.id,
          date,
          description: item.description,
          amountCents: finalAmountCents,
          type: txType,
          categoryId: categoryId ?? null,
          accountId,
          cleared: false,
          createdAt: now,
          updatedAt: now,
        });

        // Create the import tracking record
        await db.insert(fileImportedItems).values({
          id: importId,
          fileId,
          parsedItemId: itemId,
          transactionId,
          createdAt: now,
        });

        importedTransactions.push(transactionId);
      } catch (err) {
        console.error(`[file-import] Failed to import item ${itemId}:`, err);
        errors.push({
          itemId,
          error: err instanceof Error ? err.message : 'Import failed',
        });
      }
    }

    console.log(
      `[file-import] Import completed for file ${fileId}: ${importedTransactions.length} imported, ${skippedItems.length} skipped, ${errors.length} errors`
    );

    return NextResponse.json({
      ok: true,
      imported: importedTransactions,
      skipped: skippedItems,
      errors,
    });
  } catch (error) {
    console.error('Failed to import items:', error);
    return errorJson('INTERNAL_ERROR', 'Failed to import items', 500);
  }
}
