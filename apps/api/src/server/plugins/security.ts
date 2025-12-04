import type { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';

/**
 * Security plugin
 * Configures CORS and security headers
 */
const securityPluginImpl: FastifyPluginAsync = async (fastify) => {
  // CORS configuration
  await fastify.register(cors, {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  // Security headers
  await fastify.register(helmet, {
    contentSecurityPolicy: false, // Disable for API
    crossOriginEmbedderPolicy: false,
  });

  fastify.log.info('Security plugins registered (CORS, Helmet)');
};

export const securityPlugin = fp(securityPluginImpl, {
  name: 'security-plugin',
});
