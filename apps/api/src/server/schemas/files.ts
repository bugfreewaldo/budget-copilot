/**
 * File Upload Validation Schemas
 *
 * Zod schemas for validating file upload API requests.
 */

import { z } from 'zod';
import { FILE_UPLOAD_CONFIG } from '../../services/file-upload/types.js';

// ============================================================================
// Create Upload URLs
// ============================================================================

export const createUploadUrlsSchema = z.object({
  files: z
    .array(
      z.object({
        name: z
          .string()
          .min(1, 'File name is required')
          .max(255, 'File name too long'),
        type: z
          .string()
          .min(1, 'MIME type is required')
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
          .int('Size must be an integer')
          .positive('Size must be positive')
          .max(
            FILE_UPLOAD_CONFIG.maxFileSizeBytes,
            `File size exceeds maximum of ${FILE_UPLOAD_CONFIG.maxFileSizeBytes / 1024 / 1024}MB`
          ),
      })
    )
    .min(1, 'At least one file is required')
    .max(10, 'Maximum 10 files per upload'),
});

export type CreateUploadUrlsInput = z.infer<typeof createUploadUrlsSchema>;

// ============================================================================
// Complete Upload
// ============================================================================

/**
 * Validates storage key format to prevent path traversal
 */
function isValidStorageKey(key: string): boolean {
  // Must start with users/ and not contain path traversal
  if (!key.startsWith('users/')) return false;
  if (key.includes('..')) return false;
  if (key.includes('\0')) return false;
  return true;
}

export const completeUploadSchema = z.object({
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
    .min(1, 'At least one completed file is required'),
});

export type CompleteUploadInput = z.infer<typeof completeUploadSchema>;

// ============================================================================
// Import Items
// ============================================================================

export const importItemsSchema = z.object({
  items: z
    .array(
      z.object({
        id: z.string().min(1),
        categoryId: z.string().optional(),
      })
    )
    .min(1, 'At least one item is required'),
  defaultType: z.enum(['expense', 'income', 'debt_payment']).optional(),
  accountId: z.string().min(1, 'Account ID is required'),
});

export type ImportItemsInput = z.infer<typeof importItemsSchema>;

// ============================================================================
// File ID Parameter
// ============================================================================

export const fileIdSchema = z
  .string()
  .min(1, 'File ID is required')
  .max(50, 'Invalid file ID');
