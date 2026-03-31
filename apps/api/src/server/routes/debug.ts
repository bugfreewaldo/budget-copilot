import type { FastifyPluginAsync } from 'fastify';

/**
 * Debug routes (dev only)
 */
export const debugRoutes: FastifyPluginAsync = async (fastify) => {
  // Only register in development
  if (process.env.NODE_ENV === 'production') {
    return;
  }

  fastify.get('/debug/config', async (_request, reply) => {
    return reply.send({
      host: process.env.HOST,
      port: process.env.PORT,
      databaseUrl: process.env.DATABASE_URL,
      corsOrigin: process.env.CORS_ORIGIN,
      nodeEnv: process.env.NODE_ENV,
      nextPublicApiUrl: process.env.NEXT_PUBLIC_API_URL,
    });
  });
};
