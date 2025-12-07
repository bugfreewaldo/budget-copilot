import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { errorJson, json, formatZodError } from '@/lib/api/utils';
import { getAuthenticatedUser } from '@/lib/api/auth';
import { getDb } from '@/lib/db/client';
import { uploadedFiles, type NewUploadedFile } from '@/lib/db/schema';
import {
  validateStorageKeyOwnership,
  FILE_UPLOAD_CONFIG,
  isImageMimeType,
  parseFile,
} from '@/lib/file-upload';

export const dynamic = 'force-dynamic';

function isValidStorageKey(key: string): boolean {
  if (!key.startsWith('users/')) return false;
  if (key.includes('..')) return false;
  if (key.includes('\0')) return false;
  return true;
}

const completeUploadSchema = z.object({
  completedFiles: z
    .array(
      z.object({
        originalName: z.string().min(1).max(255),
        mimeType: z
          .string()
          .min(1)
          .refine(
            (type) =>
              FILE_UPLOAD_CONFIG.allowedMimeTypes.includes(
                type as (typeof FILE_UPLOAD_CONFIG.allowedMimeTypes)[number]
              ),
            { message: 'Invalid MIME type' }
          ),
        size: z.number().int().positive(),
        storageKey: z.string().min(1).refine(isValidStorageKey, {
          message: 'Invalid storage key format',
        }),
      })
    )
    .min(1),
});

/**
 * POST /api/v1/uploads/complete - Register completed uploads
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(request);
    if (!auth.success) return auth.response;

    const body = await request.json();
    const validation = completeUploadSchema.safeParse(body);

    if (!validation.success) {
      return json(formatZodError(validation.error), 400);
    }

    const userId = auth.user.id;
    const { completedFiles } = validation.data;

    // Validate all storage keys belong to this user
    for (const file of completedFiles) {
      if (!validateStorageKeyOwnership(file.storageKey, userId)) {
        return errorJson(
          'VALIDATION_ERROR',
          `Storage key ${file.storageKey} does not belong to current user`,
          400
        );
      }
    }

    const db = getDb();

    // Create file records
    const now = Date.now();
    const records: NewUploadedFile[] = completedFiles.map((file) => ({
      id: nanoid(),
      userId,
      filename: file.originalName,
      mimeType: file.mimeType,
      sizeBytes: file.size,
      storageKey: file.storageKey,
      status: 'stored' as const,
      createdAt: now,
      updatedAt: now,
    }));

    await db.insert(uploadedFiles).values(records);

    console.log(
      `[uploads/complete] Registered ${records.length} files for user ${userId}`
    );

    // Parse files based on type:
    // - Images: Parse synchronously (fast, ~5-15s)
    // - PDFs/Excel: Leave for background processing
    const fileIds = records.map((f) => f.id);
    const parsedFileIds: string[] = [];
    const queuedFileIds: string[] = [];

    for (const record of records) {
      if (isImageMimeType(record.mimeType)) {
        try {
          await parseFile(record.id);
          parsedFileIds.push(record.id);
          console.log(`[uploads/complete] Image parsed: ${record.id}`);
        } catch (error) {
          console.error(
            `[uploads/complete] Image parsing failed: ${record.id}`,
            error
          );
          // File status will be set to 'failed' by parseFile
        }
      } else {
        queuedFileIds.push(record.id);
        console.log(`[uploads/complete] File queued: ${record.id}`);
      }
    }

    return NextResponse.json({
      ok: true,
      fileIds,
      parsed: parsedFileIds,
      queued: queuedFileIds,
    });
  } catch (error) {
    console.error('Failed to complete upload:', error);
    return errorJson('INTERNAL_ERROR', 'Failed to complete upload', 500);
  }
}
