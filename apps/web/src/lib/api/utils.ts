import { NextResponse } from 'next/server';
import { z, ZodError } from 'zod';

/**
 * API utilities for Next.js route handlers
 */

// Common validation schemas
export const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be ISO date format YYYY-MM-DD');

export const monthSchema = z
  .string()
  .regex(/^\d{4}-\d{2}$/, 'Must be month format YYYY-MM');

export const idSchema = z.string().min(1, 'ID cannot be empty');

export const centsSchema = z.number().int('Must be an integer (cents)');

// Error response types
export interface ErrorResponse {
  error: {
    code:
      | 'VALIDATION_ERROR'
      | 'NOT_FOUND'
      | 'DB_ERROR'
      | 'INTERNAL_ERROR'
      | 'UNAUTHORIZED'
      | 'INVALID_TOKEN';
    message: string;
    details?: Record<string, unknown>;
  };
}

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
export function formatZodError(error: ZodError): ErrorResponse {
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

/**
 * Create JSON response with status
 */
export function json<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

/**
 * Create error JSON response
 */
export function errorJson(
  code: ErrorResponse['error']['code'],
  message: string,
  status = 500,
  details?: Record<string, unknown>
) {
  return NextResponse.json(createErrorResponse(code, message, details), {
    status,
  });
}
