import { NextRequest, NextResponse } from 'next/server';
import { eq, and, desc } from 'drizzle-orm';
import { getAuthenticatedUser } from '@/lib/api/auth';
import { errorJson } from '@/lib/api/utils';
import { getDb } from '@/lib/db/client';
import {
  uploadedFiles,
  fileParsedSummaries,
  fileImportedItems,
} from '@/lib/db/schema';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/files/:fileId/summary - Get parsed file summary
 */
export async function GET(
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

    // Check file status
    if (file.status === 'processing') {
      return errorJson(
        'PROCESSING',
        'File is still being processed. Please try again later.',
        404
      );
    }

    if (file.status === 'failed') {
      return errorJson(
        'PROCESSING_FAILED',
        `File processing failed: ${file.failureReason || 'Unknown error'}`,
        404
      );
    }

    if (file.status === 'stored') {
      return errorJson('NOT_PROCESSED', 'File has not been processed yet.', 404);
    }

    // Get the latest summary
    const summary = await db.query.fileParsedSummaries.findFirst({
      where: eq(fileParsedSummaries.fileId, fileId),
      orderBy: desc(fileParsedSummaries.createdAt),
    });

    if (!summary) {
      return errorJson('NOT_FOUND', 'No parsed summary available', 404);
    }

    // Parse the JSON safely
    let parsedSummary;
    try {
      parsedSummary = JSON.parse(summary.summaryJson);
    } catch {
      console.error(`[file-summary] Corrupted summary JSON for file ${fileId}`);
      return errorJson('DATA_ERROR', 'Summary data is corrupted', 500);
    }

    // Get already imported items
    const importedItems = await db
      .select({ parsedItemId: fileImportedItems.parsedItemId })
      .from(fileImportedItems)
      .where(eq(fileImportedItems.fileId, fileId));

    const importedItemIds = importedItems.map((i) => i.parsedItemId);

    return NextResponse.json({
      documentType: summary.documentType,
      parserVersion: summary.parserVersion,
      summary: parsedSummary,
      importedItemIds,
    });
  } catch (error) {
    console.error('Failed to get file summary:', error);
    return errorJson('INTERNAL_ERROR', 'Failed to retrieve file summary', 500);
  }
}
