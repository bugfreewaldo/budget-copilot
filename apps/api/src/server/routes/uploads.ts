/**
 * Upload Routes
 *
 * API routes for file upload flow:
 * - POST /v1/uploads/create-url - Generate pre-signed S3 URLs
 * - POST /v1/uploads/complete - Register completed uploads
 */

import type { FastifyPluginAsync } from 'fastify';
import { getDb, saveDatabase } from '../../db/client.js';
import { requireAuth } from '../plugins/auth.js';
import { createErrorResponse, formatZodError } from '../schemas/common.js';
import {
  createUploadUrlsSchema,
  completeUploadSchema,
} from '../schemas/files.js';
import {
  generateUploadUrls,
  validateStorageKeyOwnership,
  isStorageConfigured,
} from '../../services/file-upload/storage.js';
import { isImageMimeType } from '../../services/file-upload/types.js';
import * as filesRepo from '../lib/repo/files.js';
import { parseFile } from '../../services/file-upload/parseFile.js';

/**
 * Upload routes plugin
 */
export const uploadRoutes: FastifyPluginAsync = async (fastify) => {
  // ============================================================================
  // POST /v1/uploads/create-url
  // ============================================================================

  fastify.post(
    '/uploads/create-url',
    { preHandler: requireAuth },
    async (request, reply) => {
      try {
        // Check if storage is configured
        if (!isStorageConfigured()) {
          return reply.status(503).send(
            createErrorResponse(
              'STORAGE_NOT_CONFIGURED',
              'File storage is not configured. Please set S3_BUCKET and related environment variables.'
            )
          );
        }

        // Validate request body
        const validation = createUploadUrlsSchema.safeParse(request.body);
        if (!validation.success) {
          return reply.status(400).send(formatZodError(validation.error));
        }

        const userId = request.user!.id;
        const { files } = validation.data;

        // Generate pre-signed URLs
        // Type assertion needed because Zod's inferred type has optional fields
        const uploadTargets = await generateUploadUrls(
          userId,
          files as Array<{ name: string; type: string; size: number }>
        );

        request.log.info(
          { userId, fileCount: files.length },
          'Generated upload URLs'
        );

        return reply.status(200).send({
          uploadTargets,
        });
      } catch (error) {
        request.log.error({ error }, 'Failed to generate upload URLs');

        if (error instanceof Error && error.message.includes('environment variable')) {
          return reply.status(503).send(
            createErrorResponse(
              'STORAGE_NOT_CONFIGURED',
              'File storage is not properly configured'
            )
          );
        }

        return reply.status(500).send(
          createErrorResponse('UPLOAD_URL_ERROR', 'Failed to generate upload URLs')
        );
      }
    }
  );

  // ============================================================================
  // POST /v1/uploads/complete
  // ============================================================================

  fastify.post(
    '/uploads/complete',
    { preHandler: requireAuth },
    async (request, reply) => {
      try {
        // Validate request body
        const validation = completeUploadSchema.safeParse(request.body);
        if (!validation.success) {
          return reply.status(400).send(formatZodError(validation.error));
        }

        const userId = request.user!.id;
        const { completedFiles } = validation.data;

        // Validate all storage keys belong to this user
        for (const file of completedFiles) {
          if (!validateStorageKeyOwnership(file.storageKey, userId)) {
            return reply.status(400).send(
              createErrorResponse(
                'INVALID_STORAGE_KEY',
                `Storage key ${file.storageKey} does not belong to current user`
              )
            );
          }
        }

        const db = await getDb();

        // Create file records
        const fileRecords = await filesRepo.createUploadedFiles(
          db,
          completedFiles.map((file) => ({
            userId,
            filename: file.originalName,
            mimeType: file.mimeType,
            sizeBytes: file.size,
            storageKey: file.storageKey,
            status: 'stored' as const,
          }))
        );

        saveDatabase();

        request.log.info(
          { userId, fileCount: fileRecords.length },
          'Registered completed uploads'
        );

        // Parse files based on type:
        // - Images: Parse synchronously (fast, ~5-15s)
        // - PDFs/Excel: Leave for cron job (can be slow)
        const fileIds = fileRecords.map((f) => f.id);
        const parsedFileIds: string[] = [];
        const queuedFileIds: string[] = [];

        for (const record of fileRecords) {
          if (isImageMimeType(record.mimeType)) {
            // Images are fast - parse immediately
            try {
              await parseFile(record.id);
              parsedFileIds.push(record.id);
              request.log.info({ fileId: record.id }, 'Image parsed synchronously');
            } catch (error) {
              request.log.error({ error, fileId: record.id }, 'Image parsing failed');
              // File status will be set to 'failed' by parseFile
            }
          } else {
            // PDFs/Excel - leave with status 'stored' for cron to process
            queuedFileIds.push(record.id);
            request.log.info({ fileId: record.id }, 'File queued for background processing');
          }
        }

        return reply.status(200).send({
          ok: true,
          fileIds,
          parsed: parsedFileIds,
          queued: queuedFileIds,
        });
      } catch (error) {
        request.log.error({ error }, 'Failed to complete upload');
        return reply.status(500).send(
          createErrorResponse('UPLOAD_COMPLETE_ERROR', 'Failed to register uploaded files')
        );
      }
    }
  );
};
