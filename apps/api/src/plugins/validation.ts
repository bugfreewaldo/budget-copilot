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
 * Result type for safe validation
 * Using explicit undefined types helps TypeScript narrow the union correctly
 */
export type SafeValidateSuccess<T> = {
  success: true;
  data: T;
  errors?: undefined;
};

export type SafeValidateFailure = {
  success: false;
  data?: undefined;
  errors: ValidationError[];
};

export type SafeValidateResult<T> =
  | SafeValidateSuccess<T>
  | SafeValidateFailure;

/**
 * Type guard to check if validation failed
 */
export function isValidationFailure<T>(
  result: SafeValidateResult<T>
): result is SafeValidateFailure {
  return !result.success;
}

/**
 * Safe validation that returns either success or error
 */
export function safeValidate<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): SafeValidateResult<T> {
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
