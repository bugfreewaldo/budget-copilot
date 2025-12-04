import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { getDb } from '../../db/client.js';
import { categories } from '../../db/schema.js';
import { eq, and, or, gt, asc, sql as drizzleSql } from 'drizzle-orm';
import { nanoid } from 'nanoid';

/**
 * Categories V1 Routes
 * Full CRUD with cursor-based pagination, search, and hierarchy validation
 */

// ============================================================================
// Validation Schemas
// ============================================================================

export const createCategorySchema = z.object({
  name: z.string().min(1).max(64),
  parent_id: z.string().min(1).nullable().optional(),
});

export const updateCategorySchema = z.object({
  name: z.string().min(1).max(64).optional(),
  parent_id: z.string().min(1).nullable().optional(),
});

export const listCategoriesQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  q: z.string().max(100).optional(),
});

export const categoryIdSchema = z.string().min(1);

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if a category exists
 */
async function categoryExists(db: any, id: string): Promise<boolean> {
  const [category] = await db
    .select()
    .from(categories)
    .where(eq(categories.id, id));
  return !!category;
}

/**
 * Check if setting parentId would create a cycle
 * Returns true if cycle would be created
 */
async function wouldCreateCycle(
  db: any,
  categoryId: string,
  parentId: string
): Promise<boolean> {
  // Can't be parent of self
  if (categoryId === parentId) {
    return true;
  }

  // Walk up the parent chain to see if we encounter categoryId
  let currentId: string | null = parentId;
  const visited = new Set<string>();

  while (currentId) {
    if (visited.has(currentId)) {
      // Already have a cycle in the data
      return true;
    }
    visited.add(currentId);

    if (currentId === categoryId) {
      // Would create a cycle
      return true;
    }

    const [parent] = await db
      .select()
      .from(categories)
      .where(eq(categories.id, currentId));

    currentId = parent?.parentId || null;
  }

  return false;
}

/**
 * Check if category has children
 */
async function hasChildren(db: any, id: string): Promise<boolean> {
  const [child] = await db
    .select()
    .from(categories)
    .where(eq(categories.parentId, id))
    .limit(1);
  return !!child;
}

/**
 * Check if category is referenced by envelopes or transactions
 */
async function isReferenced(db: any, id: string): Promise<boolean> {
  // Import inside function to avoid circular dependency
  const { envelopes } = await import('../../db/schema.js');
  const { transactions } = await import('../../db/schema.js');

  const [envelope] = await db
    .select()
    .from(envelopes)
    .where(eq(envelopes.categoryId, id))
    .limit(1);

  if (envelope) return true;

  const [transaction] = await db
    .select()
    .from(transactions)
    .where(eq(transactions.categoryId, id))
    .limit(1);

  return !!transaction;
}

// ============================================================================
// Route Handlers
// ============================================================================

const categoriesRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * POST /v1/categories
   * Create a new category
   */
  fastify.post('/categories', async (request, reply) => {
    try {
      // Validate request body
      const validation = fastify.safeValidate(
        createCategorySchema,
        request.body
      );

      if (!validation.success) {
        return reply.badRequest('Invalid request body', validation.errors);
      }

      const data = validation.data;
      const db = await getDb();

      // Validate parent_id if provided
      if (data.parent_id) {
        const parentExists = await categoryExists(db, data.parent_id);
        if (!parentExists) {
          return reply.badRequest('Invalid parent_id: category does not exist');
        }
      }

      // Generate ID and timestamp
      const id = nanoid();
      const now = Date.now();

      // Insert category
      await db.insert(categories).values({
        id,
        name: data.name,
        parentId: data.parent_id || null,
        createdAt: now,
      });

      // Fetch the created category
      const [category] = await db
        .select()
        .from(categories)
        .where(eq(categories.id, id));

      // Set status code before caching
      reply.code(201);

      // Cache response for idempotency
      const responseBody = { data: category };
      fastify.cacheIdempotentResponse(request, reply, responseBody);

      return reply.send(responseBody);
    } catch (error) {
      request.log.error({ error }, 'Failed to create category');
      return reply.internalError();
    }
  });

  /**
   * GET /v1/categories
   * List categories with cursor-based pagination and optional search
   */
  fastify.get('/categories', async (request, reply) => {
    try {
      // Validate query params
      const validation = fastify.safeValidate(
        listCategoriesQuerySchema,
        request.query
      );

      if (!validation.success) {
        return reply.badRequest('Invalid query parameters', validation.errors);
      }

      const { cursor, limit, q } = validation.data;
      const db = await getDb();

      // Parse cursor
      const cursorData = cursor ? fastify.decodeCursor(cursor) : null;

      if (cursor && !cursorData) {
        return reply.badRequest('Invalid cursor');
      }

      // Build query
      const conditions: any[] = [];

      // Apply cursor for pagination (ASC order)
      if (cursorData) {
        conditions.push(
          or(
            gt(categories.createdAt, cursorData.createdAt),
            and(
              eq(categories.createdAt, cursorData.createdAt),
              gt(categories.id, cursorData.id)
            )
          )
        );
      }

      // Apply search filter
      if (q) {
        const searchTerm = `%${q.toLowerCase()}%`;
        conditions.push(
          drizzleSql`LOWER(${categories.name}) LIKE ${searchTerm}`
        );
      }

      // Fetch limit + 1 to check for next page
      const query = db
        .select()
        .from(categories)
        .orderBy(asc(categories.createdAt), asc(categories.id))
        .limit(limit + 1);

      if (conditions.length > 0) {
        query.where(and(...conditions));
      }

      const results = await query;

      // Create paginated response
      const response = fastify.createPaginatedResponse(
        results,
        limit,
        (item) => item.createdAt,
        (item) => item.id
      );

      return reply.send(response);
    } catch (error) {
      request.log.error({ error }, 'Failed to list categories');
      return reply.internalError();
    }
  });

  /**
   * GET /v1/categories/:id
   * Get a single category by ID
   */
  fastify.get<{ Params: { id: string } }>(
    '/categories/:id',
    async (request, reply) => {
      try {
        // Validate ID
        const validation = fastify.safeValidate(
          categoryIdSchema,
          request.params.id
        );

        if (!validation.success) {
          return reply.badRequest('Invalid category ID', validation.errors);
        }

        const db = await getDb();
        const [category] = await db
          .select()
          .from(categories)
          .where(eq(categories.id, request.params.id));

        if (!category) {
          return reply.notFound('Category', request.params.id);
        }

        return reply.send({ data: category });
      } catch (error) {
        request.log.error({ error }, 'Failed to get category');
        return reply.internalError();
      }
    }
  );

  /**
   * PATCH /v1/categories/:id
   * Update a category
   */
  fastify.patch<{ Params: { id: string } }>(
    '/categories/:id',
    async (request, reply) => {
      try {
        // Validate ID
        const idValidation = fastify.safeValidate(
          categoryIdSchema,
          request.params.id
        );

        if (!idValidation.success) {
          return reply.badRequest('Invalid category ID', idValidation.errors);
        }

        // Validate body
        const bodyValidation = fastify.safeValidate(
          updateCategorySchema,
          request.body
        );

        if (!bodyValidation.success) {
          return reply.badRequest(
            'Invalid request body',
            bodyValidation.errors
          );
        }

        const data = bodyValidation.data;
        const db = await getDb();

        // Check if category exists
        const [existing] = await db
          .select()
          .from(categories)
          .where(eq(categories.id, request.params.id));

        if (!existing) {
          return reply.notFound('Category', request.params.id);
        }

        // Build update object with only provided fields
        const updates: any = {};
        if (data.name !== undefined) updates.name = data.name;
        if (data.parent_id !== undefined) {
          // Validate parent_id if provided (not null)
          if (data.parent_id !== null) {
            const parentExists = await categoryExists(db, data.parent_id);
            if (!parentExists) {
              return reply.badRequest(
                'Invalid parent_id: category does not exist'
              );
            }

            // Check for cycles
            const cycleDetected = await wouldCreateCycle(
              db,
              request.params.id,
              data.parent_id
            );

            if (cycleDetected) {
              return reply.badRequest(
                'Invalid parent_id: would create a circular reference'
              );
            }
          }

          updates.parentId = data.parent_id;
        }

        // Perform update if there are changes
        if (Object.keys(updates).length > 0) {
          await db
            .update(categories)
            .set(updates)
            .where(eq(categories.id, request.params.id));
        }

        // Fetch updated category
        const [category] = await db
          .select()
          .from(categories)
          .where(eq(categories.id, request.params.id));

        const responseBody = { data: category };
        fastify.cacheIdempotentResponse(request, reply, responseBody);

        return reply.send(responseBody);
      } catch (error) {
        request.log.error({ error }, 'Failed to update category');
        return reply.internalError();
      }
    }
  );

  /**
   * DELETE /v1/categories/:id
   * Delete a category
   */
  fastify.delete<{ Params: { id: string } }>(
    '/categories/:id',
    async (request, reply) => {
      try {
        // Validate ID
        const validation = fastify.safeValidate(
          categoryIdSchema,
          request.params.id
        );

        if (!validation.success) {
          return reply.badRequest('Invalid category ID', validation.errors);
        }

        const db = await getDb();

        // Check if category exists
        const [existing] = await db
          .select()
          .from(categories)
          .where(eq(categories.id, request.params.id));

        if (!existing) {
          return reply.notFound('Category', request.params.id);
        }

        // Check if category has children
        if (await hasChildren(db, request.params.id)) {
          return reply.conflict('Cannot delete category with child categories');
        }

        // Check if category is referenced
        if (await isReferenced(db, request.params.id)) {
          return reply.conflict(
            'Cannot delete category that is referenced by envelopes or transactions'
          );
        }

        // Delete category
        await db.delete(categories).where(eq(categories.id, request.params.id));

        // Cache empty response for idempotency
        fastify.cacheIdempotentResponse(request, reply, null);

        return reply.code(204).send();
      } catch (error) {
        request.log.error({ error }, 'Failed to delete category');
        return reply.internalError();
      }
    }
  );
};

export default categoriesRoutes;
