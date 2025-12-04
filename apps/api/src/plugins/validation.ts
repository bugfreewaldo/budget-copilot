import type { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import { z, type ZodError } from 'zod';

/**
 * Validation plugin with Zod
 * Provides helpers for request validation and error formatting
 */

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

/**
 * Format Zod errors into a structured array
 */
export function formatZodErrors(error: ZodError): ValidationError[] {
  return error.issues.map((issue) => ({
    field: issue.path.join('.'),
    message: issue.message,
    code: issue.code,
  }));
}

/**
 * Validate data against a Zod schema
 * Throws on validation failure with formatted errors
 */
export function validate<T>(schema: z.ZodSchema<T>, data: unknown): T {
  return schema.parse(data);
}

/**
 * Safe validation that returns either success or error
 */
export function safeValidate<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; errors: ValidationError[] } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, errors: formatZodErrors(result.error) };
}

const validationPlugin: FastifyPluginAsync = async (fastify) => {
  // Add validation helpers to fastify instance
  fastify.decorate('validate', validate);
  fastify.decorate('safeValidate', safeValidate);
  fastify.decorate('formatZodErrors', formatZodErrors);
};

export default fp(validationPlugin, {
  name: 'validation',
  fastify: '4.x',
});

// Extend Fastify types
declare module 'fastify' {
  interface FastifyInstance {
    validate: typeof validate;
    safeValidate: typeof safeValidate;
    formatZodErrors: typeof formatZodErrors;
  }
}
