/**
 * Cron Routes
 *
 * Protected endpoints for scheduled tasks.
 * These should be called by Vercel Cron or similar schedulers.
 *
 * Security: All cron endpoints require CRON_SECRET header for authentication.
 */

import type { FastifyPluginAsync } from 'fastify';
import { getDb, saveDatabase } from '../../db/client.js';
import * as filesRepo from '../lib/repo/files.js';
import { parseFile } from '../../services/file-upload/parseFile.js';

/**
 * Verify cron secret to prevent unauthorized access
 */
function verifyCronSecret(authHeader: string | undefined): boolean {
  const cronSecret = process.env.CRON_SECRET;

  // If no CRON_SECRET is set, reject all requests
  if (!cronSecret) {
    console.warn('[Cron] CRON_SECRET not configured - rejecting request');
    return false;
  }

  // Check Bearer token format
  if (!authHeader?.startsWith('Bearer ')) {
    return false;
  }

  const token = authHeader.slice(7);
  return token === cronSecret;
}

/**
 * Cron routes plugin
 */
export const cronRoutes: FastifyPluginAsync = async (fastify) => {
  // ============================================================================
  // GET /v1/cron/parse-files
  // Processes pending files (PDFs, Excel) that weren't parsed synchronously
  // ============================================================================

  fastify.get('/cron/parse-files', async (request, reply) => {
    // Verify cron secret
    const authHeader = request.headers['authorization'];
    if (!verifyCronSecret(authHeader)) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    try {
      const db = await getDb();

      // Get files pending processing (status = 'stored')
      const pendingFiles = await filesRepo.getFilesPendingProcessing(db);

      if (pendingFiles.length === 0) {
        return reply.status(200).send({
          ok: true,
          message: 'No files to process',
          processed: 0,
        });
      }

      // Process up to 5 files per cron run to avoid timeout
      const MAX_FILES_PER_RUN = 5;
      const filesToProcess = pendingFiles.slice(0, MAX_FILES_PER_RUN);

      const results: Array<{
        fileId: string;
        success: boolean;
        error?: string;
      }> = [];

      for (const file of filesToProcess) {
        try {
          request.log.info(
            { fileId: file.id, filename: file.filename },
            'Processing file via cron'
          );

          await parseFile(file.id);

          results.push({ fileId: file.id, success: true });

          request.log.info({ fileId: file.id }, 'File processed successfully');
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : 'Unknown error';

          results.push({
            fileId: file.id,
            success: false,
            error: errorMessage,
          });

          request.log.error(
            { error, fileId: file.id },
            'Failed to process file'
          );
        }
      }

      saveDatabase();

      const successCount = results.filter((r) => r.success).length;
      const failCount = results.filter((r) => !r.success).length;

      request.log.info(
        {
          total: pendingFiles.length,
          processed: filesToProcess.length,
          success: successCount,
          failed: failCount,
        },
        'Cron job completed'
      );

      return reply.status(200).send({
        ok: true,
        totalPending: pendingFiles.length,
        processed: filesToProcess.length,
        success: successCount,
        failed: failCount,
        results,
      });
    } catch (error) {
      request.log.error({ error }, 'Cron job failed');
      return reply.status(500).send({
        ok: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // ============================================================================
  // GET /v1/cron/health
  // Simple health check for cron monitoring
  // ============================================================================

  fastify.get('/cron/health', async (request, reply) => {
    // Verify cron secret
    const authHeader = request.headers['authorization'];
    if (!verifyCronSecret(authHeader)) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    try {
      const db = await getDb();
      const pendingCount = (await filesRepo.getFilesPendingProcessing(db))
        .length;

      return reply.status(200).send({
        ok: true,
        pendingFiles: pendingCount,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      return reply.status(500).send({
        ok: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });
};
