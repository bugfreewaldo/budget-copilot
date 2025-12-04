import { z } from 'zod';
import { idSchema } from './common.js';

/**
 * Category validation schemas
 */

export const createCategorySchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  parentId: idSchema.optional(),
  emoji: z.string().max(10).optional(),
  color: z.string().max(20).optional(),
});

export const categorySchema = z.object({
  id: idSchema,
  name: z.string(),
  parentId: z.string().nullable(),
  emoji: z.string().nullable(),
  color: z.string().nullable(),
  createdAt: z.date(),
});

export const listCategoriesQuerySchema = z.object({
  parentId: idSchema.optional(),
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type Category = z.infer<typeof categorySchema>;
export type ListCategoriesQuery = z.infer<typeof listCategoriesQuerySchema>;
