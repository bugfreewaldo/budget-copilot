import { z } from 'zod';
import { idSchema, monthSchema, positiveCentsSchema } from './common.js';

/**
 * Envelope validation schemas
 */

export const createEnvelopeSchema = z.object({
  categoryId: idSchema,
  month: monthSchema,
  budgetCents: positiveCentsSchema,
});

export const envelopeSchema = z.object({
  id: idSchema,
  categoryId: z.string(),
  month: z.string(),
  budgetCents: z.number(),
  createdAt: z.number(), // Unix timestamp
});

// Envelope with computed spending
export const envelopeWithSpendingSchema = envelopeSchema.extend({
  spentCents: z.number(),
  remainingCents: z.number(),
});

export const listEnvelopesQuerySchema = z.object({
  month: monthSchema,
});

export type CreateEnvelopeInput = z.infer<typeof createEnvelopeSchema>;
export type Envelope = z.infer<typeof envelopeSchema>;
export type EnvelopeWithSpending = z.infer<typeof envelopeWithSpendingSchema>;
export type ListEnvelopesQuery = z.infer<typeof listEnvelopesQuerySchema>;
