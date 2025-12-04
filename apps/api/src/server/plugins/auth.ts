import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import { validateSession, type User } from '../../services/auth/index.js';

const SESSION_COOKIE_NAME = 'session';

// Extend FastifyRequest to include user
declare module 'fastify' {
  interface FastifyRequest {
    user?: User;
  }
}

/**
 * Authentication plugin
 * Adds authentication helpers and decorators to Fastify
 */
async function authPlugin(fastify: FastifyInstance) {
  // Decorator to get current user (returns null if not authenticated)
  fastify.decorateRequest('user', null);

  // Pre-handler hook to populate user from session
  fastify.addHook('preHandler', async (request: FastifyRequest) => {
    const sessionToken = request.cookies[SESSION_COOKIE_NAME];

    if (sessionToken) {
      const user = await validateSession(sessionToken);
      if (user) {
        request.user = user;
      }
    }
  });
}

/**
 * Require authentication middleware
 * Use this as a preHandler for routes that require authentication
 */
export async function requireAuth(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  if (!request.user) {
    reply.status(401).send({
      error: 'UNAUTHORIZED',
      message: 'Authentication required',
    });
    return;
  }
}

/**
 * Optional authentication middleware
 * Populates user if authenticated but doesn't require it
 * Useful for routes that have different behavior for authenticated users
 */
export async function optionalAuth(
  _request: FastifyRequest,
  _reply: FastifyReply
) {
  // User is already populated by the plugin hook if authenticated
  // This middleware does nothing extra, just serves as documentation
}

/**
 * Require specific plan middleware
 * Use after requireAuth to restrict routes to certain plans
 */
export function requirePlan(...plans: ('free' | 'pro' | 'premium')[]) {
  return async function (request: FastifyRequest, reply: FastifyReply): Promise<void> {
    if (!request.user) {
      reply.status(401).send({
        error: 'UNAUTHORIZED',
        message: 'Authentication required',
      });
      return;
    }

    if (!plans.includes(request.user.plan)) {
      reply.status(403).send({
        error: 'PLAN_REQUIRED',
        message: `This feature requires one of the following plans: ${plans.join(', ')}`,
        requiredPlans: plans,
        currentPlan: request.user.plan,
      });
      return;
    }
  };
}

/**
 * Require email verification middleware
 * Use after requireAuth to restrict routes to verified users
 */
export async function requireVerifiedEmail(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  if (!request.user) {
    reply.status(401).send({
      error: 'UNAUTHORIZED',
      message: 'Authentication required',
    });
    return;
  }

  if (!request.user.emailVerified) {
    reply.status(403).send({
      error: 'EMAIL_NOT_VERIFIED',
      message: 'Please verify your email address to access this feature',
    });
    return;
  }
}

export default fp(authPlugin, {
  name: 'auth',
  dependencies: ['@fastify/cookie'],
});
