import { z } from 'zod';
import { idSchema, isoDateSchema, centsSchema } from './common.js';

/**
 * Transaction validation schemas
 */

export const transactionTypeSchema = z.enum(['income', 'expense']);

export const createTransactionSchema = z.object({
  date: isoDateSchema,
  description: z.string().min(1, 'Description is required').max(500),
  amountCents: centsSchema,
  type: transactionTypeSchema,
  categoryId: idSchema.optional(),
  accountId: idSchema,
  cleared: z.boolean().optional().default(false),
  notes: z.string().max(1000).optional(),
});

export const updateTransactionSchema = createTransactionSchema.partial();

export const transactionSchema = z.object({
  id: idSchema,
  date: z.string(),
  description: z.string(),
  amountCents: z.number(),
  type: transactionTypeSchema,
  categoryId: z.string().nullable(),
  accountId: z.string(),
  cleared: z.boolean(),
  notes: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const listTransactionsQuerySchema = z.object({
  from: isoDateSchema.optional(),
  to: isoDateSchema.optional(),
  categoryId: idSchema.optional(),
  accountId: idSchema.optional(),
  q: z.string().optional(), // Search query for description
});

export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;
export type UpdateTransactionInput = z.infer<typeof updateTransactionSchema>;
export type Transaction = z.infer<typeof transactionSchema>;
export type ListTransactionsQuery = z.infer<typeof listTransactionsQuerySchema>;
