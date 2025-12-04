import type { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';

/**
 * Environment validation plugin
 * Ensures required env vars are present
 */
const envPluginImpl: FastifyPluginAsync = async (fastify) => {
  const requiredEnvVars = ['DATABASE_URL'];

  const missing = requiredEnvVars.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}`
    );
  }

  fastify.log.info({
    env: {
      nodeEnv: process.env.NODE_ENV || 'development',
      databaseUrl: process.env.DATABASE_URL,
      port: process.env.PORT || 4000,
    },
  }, 'Environment validated');
};

export const envPlugin = fp(envPluginImpl, {
  name: 'env-plugin',
});
