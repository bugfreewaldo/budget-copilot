import { z } from 'zod';

/**
 * Common validation schemas and utilities
 */

// ISO date string validation (YYYY-MM-DD)
export const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be ISO date format YYYY-MM-DD');

// Month string validation (YYYY-MM)
export const monthSchema = z
  .string()
  .regex(/^\d{4}-\d{2}$/, 'Must be month format YYYY-MM');

// ID validation (non-empty string)
export const idSchema = z.string().min(1, 'ID cannot be empty');

// Cents validation (integer, can be negative for expenses)
export const centsSchema = z.number().int('Must be an integer (cents)');

// Positive cents only
export const positiveCentsSchema = z
  .number()
  .int()
  .positive('Must be positive');

// API error response schema
export const errorResponseSchema = z.object({
  error: z.object({
    code: z.enum([
      'VALIDATION_ERROR',
      'NOT_FOUND',
      'DB_ERROR',
      'INTERNAL_ERROR',
      // File upload error codes
      'STORAGE_NOT_CONFIGURED',
      'UPLOAD_URL_ERROR',
      'INVALID_STORAGE_KEY',
      'UPLOAD_COMPLETE_ERROR',
      'PROCESSING',
      'PROCESSING_FAILED',
      'NOT_PROCESSED',
      'DATA_ERROR',
      'IMPORT_ERROR',
    ]),
    message: z.string(),
    details: z.record(z.unknown()).optional(),
  }),
});

export type ErrorResponse = z.infer<typeof errorResponseSchema>;

/**
 * Create a standard error response
 */
export function createErrorResponse(
  code: ErrorResponse['error']['code'],
  message: string,
  details?: Record<string, unknown>
): ErrorResponse {
  return {
    error: {
      code,
      message,
      ...(details && { details }),
    },
  };
}

/**
 * Format Zod validation errors
 */
export function formatZodError(error: z.ZodError): ErrorResponse {
  const details: Record<string, string> = {};

  error.errors.forEach((err) => {
    const path = err.path.join('.');
    details[path] = err.message;
  });

  return createErrorResponse(
    'VALIDATION_ERROR',
    'Request validation failed',
    details
  );
}
