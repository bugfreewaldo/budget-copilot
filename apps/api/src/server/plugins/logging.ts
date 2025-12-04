import type { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';

/**
 * Logging plugin
 * Adds request/response logging with duration
 */
const loggingPluginImpl: FastifyPluginAsync = async (fastify) => {
  // Log all requests with timing
  fastify.addHook('onRequest', async (request, _reply) => {
    request.log.info(
      {
        reqId: request.id,
        method: request.method,
        url: request.url,
        ip: request.ip,
      },
      'incoming request'
    );
  });

  // Log all responses with duration
  fastify.addHook('onResponse', async (request, reply) => {
    request.log.info(
      {
        reqId: request.id,
        method: request.method,
        url: request.url,
        statusCode: reply.statusCode,
        durationMs: reply.getResponseTime(),
      },
      'request completed'
    );
  });

  // Log errors
  fastify.addHook('onError', async (request, reply, error) => {
    request.log.error(
      {
        reqId: request.id,
        method: request.method,
        url: request.url,
        error: {
          message: error.message,
          stack: error.stack,
        },
      },
      'request error'
    );
  });
};

export const loggingPlugin = fp(loggingPluginImpl, {
  name: 'logging-plugin',
});
