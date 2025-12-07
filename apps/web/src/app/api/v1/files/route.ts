import { NextRequest, NextResponse } from 'next/server';
import { desc, eq } from 'drizzle-orm';
import { getAuthenticatedUser } from '@/lib/api/auth';
import { errorJson } from '@/lib/api/utils';
import { getDb } from '@/lib/db/client';
import { uploadedFiles, fileParsedSummaries } from '@/lib/db/schema';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/files - List uploaded files
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(request);
    if (!auth.success) return auth.response;

    const db = getDb();

    const files = await db.query.uploadedFiles.findMany({
      where: eq(uploadedFiles.userId, auth.user.id),
      orderBy: [desc(uploadedFiles.createdAt)],
    });

    // Get latest summary for each file
    const filesWithSummaries = await Promise.all(
      files.map(async (file) => {
        const summary = await db.query.fileParsedSummaries.findFirst({
          where: eq(fileParsedSummaries.fileId, file.id),
          orderBy: [desc(fileParsedSummaries.createdAt)],
        });

        return {
          ...file,
          summary: summary
            ? {
                id: summary.id,
                documentType: summary.documentType,
                parsedData: JSON.parse(summary.summaryJson),
              }
            : null,
        };
      })
    );

    return NextResponse.json({ data: filesWithSummaries });
  } catch (error) {
    console.error('Failed to list files:', error);
    return errorJson('INTERNAL_ERROR', 'Failed to list files', 500);
  }
}
