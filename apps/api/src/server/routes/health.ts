import type { FastifyPluginAsync } from 'fastify';
import { config } from '../../config.js';

/**
 * Health check routes
 */
export const healthRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/health', async (_request, reply) => {
    return reply.send({
      status: 'ok',
      dbUrl: config.libsqlUrl,
      timestamp: new Date().toISOString(),
    });
  });
};
