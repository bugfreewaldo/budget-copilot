import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { errorJson, json, formatZodError } from '@/lib/api/utils';
import { getAuthenticatedUser } from '@/lib/api/auth';
import {
  generateUploadUrls,
  isStorageConfigured,
  FILE_UPLOAD_CONFIG,
} from '@/lib/file-upload';

export const dynamic = 'force-dynamic';

const createUploadUrlsSchema = z.object({
  files: z
    .array(
      z.object({
        name: z.string().min(1).max(255),
        type: z
          .string()
          .min(1)
          .refine(
            (type) =>
              FILE_UPLOAD_CONFIG.allowedMimeTypes.includes(
                type as (typeof FILE_UPLOAD_CONFIG.allowedMimeTypes)[number]
              ),
            {
              message: `File type must be one of: ${FILE_UPLOAD_CONFIG.allowedMimeTypes.join(', ')}`,
            }
          ),
        size: z
          .number()
          .int()
          .positive()
          .max(FILE_UPLOAD_CONFIG.maxFileSizeBytes),
      })
    )
    .min(1)
    .max(10),
});

/**
 * POST /api/v1/uploads/create-url - Generate pre-signed S3 URLs
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(request);
    if (!auth.success) return auth.response;

    if (!isStorageConfigured()) {
      return errorJson(
        'INTERNAL_ERROR',
        'File storage is not configured. Please set S3_BUCKET and related environment variables.',
        503
      );
    }

    const body = await request.json();
    const validation = createUploadUrlsSchema.safeParse(body);

    if (!validation.success) {
      return json(formatZodError(validation.error), 400);
    }

    const { files } = validation.data;

    const uploadTargets = await generateUploadUrls(
      auth.user.id,
      files as Array<{ name: string; type: string; size: number }>
    );

    return NextResponse.json({ uploadTargets });
  } catch (error) {
    console.error('Failed to create upload URL:', error);

    if (
      error instanceof Error &&
      error.message.includes('environment variable')
    ) {
      return errorJson(
        'INTERNAL_ERROR',
        'File storage is not properly configured',
        503
      );
    }

    return errorJson('INTERNAL_ERROR', 'Failed to create upload URL', 500);
  }
}
