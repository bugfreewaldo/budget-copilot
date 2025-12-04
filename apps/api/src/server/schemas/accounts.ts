import { z } from 'zod';
import { idSchema } from './common.js';

/**
 * Account validation schemas
 */

export const accountTypeSchema = z.enum([
  'checking',
  'savings',
  'credit',
  'cash',
]);

export const createAccountSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  institution: z.string().max(100).optional(),
  type: accountTypeSchema,
});

export const accountSchema = z.object({
  id: idSchema,
  name: z.string(),
  institution: z.string().nullable(),
  type: accountTypeSchema,
  createdAt: z.date(),
});

export type CreateAccountInput = z.infer<typeof createAccountSchema>;
export type Account = z.infer<typeof accountSchema>;
