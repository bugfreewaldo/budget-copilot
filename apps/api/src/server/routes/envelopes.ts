import type { FastifyPluginAsync } from 'fastify';
import { getDb, saveDatabase } from '../../db/client.js';
import {
  createEnvelopeSchema,
  listEnvelopesQuerySchema,
  type EnvelopeWithSpending,
} from '../schemas/envelopes.js';
import { createErrorResponse, formatZodError } from '../schemas/common.js';
import * as envelopeRepo from '../lib/repo/envelopes.js';

/**
 * Envelope routes
 * GET /v1/envelopes?month=YYYY-MM - List envelopes with computed spending
 * POST /v1/envelopes - Create or update envelope (upsert)
 */
export const envelopeRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /v1/envelopes - List envelopes with spending calculation
  fastify.get('/envelopes', async (request, reply) => {
    try {
      // Validate query params
      const validation = listEnvelopesQuerySchema.safeParse(request.query);

      if (!validation.success) {
        return reply.status(400).send(formatZodError(validation.error));
      }

      const db = await getDb();
      const envelopes = await envelopeRepo.findEnvelopesByMonth(
        db,
        validation.data.month
      );

      // Calculate spending for each envelope
      const envelopesWithSpending: EnvelopeWithSpending[] = await Promise.all(
        envelopes.map(async (envelope) => {
          const spentCents = await envelopeRepo.calculateEnvelopeSpending(
            db,
            envelope.categoryId,
            envelope.month
          );

          return {
            ...envelope,
            spentCents,
            remainingCents: envelope.budgetCents - spentCents,
          };
        })
      );

      return reply.send({ data: envelopesWithSpending });
    } catch (error) {
      request.log.error({ error }, 'Failed to list envelopes');
      return reply.status(500).send(
        createErrorResponse(
          'DB_ERROR',
          'Failed to retrieve envelopes',
          { error: (error as Error).message }
        )
      );
    }
  });

  // POST /v1/envelopes - Create or update envelope
  fastify.post('/envelopes', async (request, reply) => {
    try {
      // Validate request body
      const validation = createEnvelopeSchema.safeParse(request.body);

      if (!validation.success) {
        return reply.status(400).send(formatZodError(validation.error));
      }

      const db = await getDb();
      const envelope = await envelopeRepo.upsertEnvelope(db, validation.data);

      // Save database after mutation
      saveDatabase();

      request.log.info(
        {
          envelopeId: envelope?.id,
          categoryId: validation.data.categoryId,
          month: validation.data.month,
        },
        'Envelope upserted'
      );

      return reply.status(201).send({ data: envelope });
    } catch (error) {
      request.log.error({ error }, 'Failed to upsert envelope');
      return reply.status(500).send(
        createErrorResponse(
          'DB_ERROR',
          'Failed to create/update envelope',
          { error: (error as Error).message }
        )
      );
    }
  });
};
