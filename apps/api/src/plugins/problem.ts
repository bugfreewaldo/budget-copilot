import type { FastifyPluginAsync, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import type { ValidationError } from './validation.js';

/**
 * Problem+JSON (RFC 7807) response plugin
 * Provides standardized error responses
 */

export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance?: string;
  errors?: ValidationError[];
}

/**
 * Create a Problem+JSON response
 */
export function createProblem(
  reply: FastifyReply,
  problem: ProblemDetails
): FastifyReply {
  return reply
    .code(problem.status)
    .type('application/problem+json')
    .send(problem);
}

/**
 * 400 Bad Request - validation failure
 */
export function badRequest(
  reply: FastifyReply,
  detail: string,
  errors?: ValidationError[]
): FastifyReply {
  return createProblem(reply, {
    type: 'https://budget-copilot.dev/problems/bad-request',
    title: 'Bad Request',
    status: 400,
    detail,
    instance: reply.request.url,
    errors,
  });
}

/**
 * 404 Not Found
 */
export function notFound(
  reply: FastifyReply,
  resource: string,
  id?: string
): FastifyReply {
  const detail = id
    ? `${resource} with id '${id}' not found`
    : `${resource} not found`;

  return createProblem(reply, {
    type: 'https://budget-copilot.dev/problems/not-found',
    title: 'Not Found',
    status: 404,
    detail,
    instance: reply.request.url,
  });
}

/**
 * 409 Conflict - business logic constraint violation
 */
export function conflict(reply: FastifyReply, detail: string): FastifyReply {
  return createProblem(reply, {
    type: 'https://budget-copilot.dev/problems/conflict',
    title: 'Conflict',
    status: 409,
    detail,
    instance: reply.request.url,
  });
}

/**
 * 422 Unprocessable Entity - semantic validation failure
 */
export function unprocessableEntity(
  reply: FastifyReply,
  detail: string,
  errors?: ValidationError[]
): FastifyReply {
  return createProblem(reply, {
    type: 'https://budget-copilot.dev/problems/unprocessable-entity',
    title: 'Unprocessable Entity',
    status: 422,
    detail,
    instance: reply.request.url,
    errors,
  });
}

/**
 * 500 Internal Server Error
 * Never expose internal error details
 */
export function internalError(
  reply: FastifyReply,
  detail?: string
): FastifyReply {
  return createProblem(reply, {
    type: 'https://budget-copilot.dev/problems/internal-error',
    title: 'Internal Server Error',
    status: 500,
    detail: detail || 'An unexpected error occurred',
    instance: reply.request.url,
  });
}

const problemPlugin: FastifyPluginAsync = async (fastify) => {
  // Add problem helpers to reply
  fastify.decorateReply(
    'problem',
    function (this: FastifyReply, problem: ProblemDetails) {
      return createProblem(this, problem);
    }
  );

  fastify.decorateReply(
    'badRequest',
    function (this: FastifyReply, detail: string, errors?: ValidationError[]) {
      return badRequest(this, detail, errors);
    }
  );

  fastify.decorateReply(
    'notFound',
    function (this: FastifyReply, resource: string, id?: string) {
      return notFound(this, resource, id);
    }
  );

  fastify.decorateReply(
    'conflict',
    function (this: FastifyReply, detail: string) {
      return conflict(this, detail);
    }
  );

  fastify.decorateReply(
    'unprocessableEntity',
    function (this: FastifyReply, detail: string, errors?: ValidationError[]) {
      return unprocessableEntity(this, detail, errors);
    }
  );

  fastify.decorateReply(
    'internalError',
    function (this: FastifyReply, detail?: string) {
      return internalError(this, detail);
    }
  );
};

export default fp(problemPlugin, {
  name: 'problem',
  fastify: '4.x',
});

// Extend Fastify types
declare module 'fastify' {
  interface FastifyReply {
    problem(problem: ProblemDetails): FastifyReply;
    badRequest(detail: string, errors?: ValidationError[]): FastifyReply;
    notFound(resource: string, id?: string): FastifyReply;
    conflict(detail: string): FastifyReply;
    unprocessableEntity(
      detail: string,
      errors?: ValidationError[]
    ): FastifyReply;
    internalError(detail?: string): FastifyReply;
  }
}
