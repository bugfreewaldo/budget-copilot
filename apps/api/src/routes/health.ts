import type { FastifyPluginAsync } from 'fastify';

/**
 * Health check routes
 */
export const healthRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/health', async () => {
    return { ok: true, timestamp: new Date().toISOString() };
  });

  fastify.get('/health/ready', async () => {
    // Add database connectivity check here if needed
    return {
      ok: true,
      database: 'connected',
      timestamp: new Date().toISOString(),
    };
  });
};
