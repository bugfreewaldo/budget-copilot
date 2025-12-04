import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import crypto from 'crypto';

/**
 * Idempotency plugin
 * Implements idempotency key caching with TTL
 */

interface IdempotencyEntry {
  statusCode: number;
  headers: Record<string, string>;
  body: string; // Store as serialized string
  timestamp: number;
}

// In-memory cache with TTL cleanup
const idempotencyCache = new Map<string, IdempotencyEntry>();
const TTL_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Cleanup expired entries periodically
 */
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of idempotencyCache.entries()) {
    if (now - entry.timestamp > TTL_MS) {
      idempotencyCache.delete(key);
    }
  }
}, 60 * 1000); // Clean every minute

/**
 * Generate a hash of the request body for comparison
 */
function hashRequestBody(body: unknown): string {
  const normalized = JSON.stringify(body || {});
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

/**
 * Create a cache key from idempotency-key header and request hash
 */
function createCacheKey(
  idempotencyKey: string,
  method: string,
  path: string,
  bodyHash: string
): string {
  return `${idempotencyKey}:${method}:${path}:${bodyHash}`;
}

/**
 * Check if request is idempotent (has matching cached response)
 */
export function checkIdempotency(
  request: FastifyRequest,
  reply: FastifyReply
): boolean {
  const idempotencyKey = request.headers['idempotency-key'] as
    | string
    | undefined;

  // Only apply to mutating methods
  const method = request.method;
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    return false;
  }

  // Skip idempotency for auth routes (login, register, logout, etc.)
  if (request.url.startsWith('/v1/auth/')) {
    return false;
  }

  // Idempotency-Key is required for mutating operations
  if (!idempotencyKey) {
    reply.badRequest(
      'Idempotency-Key header is required for mutating operations'
    );
    return true; // Stop processing
  }

  // Generate cache key
  const bodyHash = hashRequestBody(request.body);
  const cacheKey = createCacheKey(
    idempotencyKey,
    method,
    request.url,
    bodyHash
  );

  // Check cache
  const cached = idempotencyCache.get(cacheKey);
  if (cached) {
    const age = Date.now() - cached.timestamp;

    // Return cached response
    // Set headers first
    for (const [key, value] of Object.entries(cached.headers)) {
      reply.header(key, value);
    }
    reply.header('X-Idempotency-Replayed', 'true');
    reply.header('X-Idempotency-Age', age.toString());

    // Then set status and send body
    reply.code(cached.statusCode).send(cached.body);

    return true; // Stop processing
  }

  // Store cache key in request for later use
  (request as IdempotencyRequest).idempotencyCacheKey = cacheKey;

  return false; // Continue processing
}

/**
 * Cache the response for future idempotent requests
 */
interface IdempotencyRequest extends FastifyRequest {
  idempotencyCacheKey?: string;
}

export function cacheIdempotentResponse(
  request: FastifyRequest,
  reply: FastifyReply,
  body: unknown
): void {
  const cacheKey = (request as IdempotencyRequest).idempotencyCacheKey;

  if (!cacheKey) {
    return;
  }

  // Don't cache error responses (4xx, 5xx)
  if (reply.statusCode >= 400) {
    return;
  }

  // Cache successful response (serialize body to string)
  idempotencyCache.set(cacheKey, {
    statusCode: reply.statusCode,
    headers: {
      'content-type': reply.getHeader('content-type') as string,
    },
    body: JSON.stringify(body),
    timestamp: Date.now(),
  });
}

/**
 * Idempotency onRequest hook
 */
async function idempotencyHook(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  // Check if this is a replayed request
  const shouldStop = checkIdempotency(request, reply);

  // If replayed, Fastify will not continue to route handler
  if (shouldStop) {
    return;
  }
}

const idempotencyPlugin: FastifyPluginAsync = async (fastify) => {
  // Add onRequest hook for all routes
  fastify.addHook('onRequest', idempotencyHook);

  // Add helpers
  fastify.decorate('cacheIdempotentResponse', cacheIdempotentResponse);
};

export default fp(idempotencyPlugin, {
  name: 'idempotency',
  fastify: '4.x',
});

// Extend Fastify types
declare module 'fastify' {
  interface FastifyInstance {
    cacheIdempotentResponse: typeof cacheIdempotentResponse;
  }
}
