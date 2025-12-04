import type { FastifyPluginAsync } from 'fastify';
import { getDb, saveDatabase } from '../../db/client.js';
import {
  createCategorySchema,
  listCategoriesQuerySchema,
} from '../schemas/categories.js';
import { createErrorResponse, formatZodError } from '../schemas/common.js';
import * as categoryRepo from '../lib/repo/categories.js';

/**
 * Category routes
 * GET /v1/categories - List all categories (optionally filter by parentId)
 * POST /v1/categories - Create new category
 */
export const categoryRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /v1/categories - List categories
  fastify.get('/categories', async (request, reply) => {
    try {
      // Validate query params
      const validation = listCategoriesQuerySchema.safeParse(request.query);

      if (!validation.success) {
        return reply.status(400).send(formatZodError(validation.error));
      }

      const db = await getDb();
      const categories = await categoryRepo.findAllCategories(
        db,
        validation.data.parentId
      );

      return reply.send({ data: categories });
    } catch (error) {
      request.log.error({ error }, 'Failed to list categories');
      return reply.status(500).send(
        createErrorResponse(
          'DB_ERROR',
          'Failed to retrieve categories',
          { error: (error as Error).message }
        )
      );
    }
  });

  // POST /v1/categories - Create new category
  fastify.post('/categories', async (request, reply) => {
    try {
      // Validate request body
      const validation = createCategorySchema.safeParse(request.body);

      if (!validation.success) {
        return reply.status(400).send(formatZodError(validation.error));
      }

      const db = await getDb();
      const category = await categoryRepo.createCategory(db, validation.data);

      // Save database after mutation
      saveDatabase();

      request.log.info({ categoryId: category?.id }, 'Category created');

      return reply.status(201).send({ data: category });
    } catch (error) {
      request.log.error({ error }, 'Failed to create category');
      return reply.status(500).send(
        createErrorResponse(
          'DB_ERROR',
          'Failed to create category',
          { error: (error as Error).message }
        )
      );
    }
  });
};
