import type { FastifyPluginAsync } from 'fastify';
import { config } from '../../config.js';

/**
 * Health check routes
 */
export const healthRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/health', async (_request, reply) => {
    return reply.send({
      status: 'ok',
      dbFile: config.databaseUrl,
      timestamp: new Date().toISOString(),
    });
  });
};
