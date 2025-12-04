import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { getDb } from '../../db/client.js';
import { accounts } from '../../db/schema.js';
import { eq, and, or, lt, desc, sql as drizzleSql } from 'drizzle-orm';
import { nanoid } from 'nanoid';

/**
 * Accounts V1 Routes
 * Full CRUD with cursor-based pagination and search
 */

// ============================================================================
// Validation Schemas
// ============================================================================

const accountTypeEnum = z.enum(['checking', 'savings', 'credit', 'cash']);

export const createAccountSchema = z.object({
  name: z.string().min(1).max(100),
  institution: z.string().max(100).optional().default(''),
  type: accountTypeEnum,
});

export const updateAccountSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  institution: z.string().max(100).optional(),
  type: accountTypeEnum.optional(),
});

export const listAccountsQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  q: z.string().max(100).optional(),
});

export const accountIdSchema = z.string().min(1);

// ============================================================================
// Route Handlers
// ============================================================================

const accountsRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * POST /v1/accounts
   * Create a new account
   */
  fastify.post('/accounts', async (request, reply) => {
    try {
      // For now, use a default test user ID
      // TODO: Replace with actual authentication when auth routes are ready
      const userId = 'test-user-id';

      // Validate request body
      const validation = fastify.safeValidate(
        createAccountSchema,
        request.body
      );

      if (!validation.success) {
        return reply.badRequest(
          'Invalid request body',
          'errors' in validation ? validation.errors : []
        );
      }

      const data = validation.data;
      const db = await getDb();

      // Generate ID and timestamp
      const id = nanoid();
      const now = Date.now();

      // Insert account
      await db.insert(accounts).values({
        id,
        userId,
        name: data.name,
        institution: data.institution,
        type: data.type,
        createdAt: now,
      });

      // Fetch the created account
      const [account] = await db
        .select()
        .from(accounts)
        .where(eq(accounts.id, id));

      // Set status code before caching
      reply.code(201);

      // Cache response for idempotency
      const responseBody = { data: account };
      fastify.cacheIdempotentResponse(request, reply, responseBody);

      return reply.send(responseBody);
    } catch (error) {
      request.log.error({ error }, 'Failed to create account');
      return reply.internalError();
    }
  });

  /**
   * GET /v1/accounts
   * List accounts with cursor-based pagination and optional search
   */
  fastify.get('/accounts', async (request, reply) => {
    try {
      // For now, use a default test user ID
      // TODO: Replace with actual authentication when auth routes are ready
      const userId = 'test-user-id';

      // Validate query params
      const validation = fastify.safeValidate(
        listAccountsQuerySchema,
        request.query
      );

      if (!validation.success) {
        return reply.badRequest(
          'Invalid query parameters',
          'errors' in validation ? validation.errors : []
        );
      }

      const { cursor, limit, q } = validation.data;
      const db = await getDb();

      // Parse cursor
      const cursorData = cursor ? fastify.decodeCursor(cursor) : null;

      if (cursor && !cursorData) {
        return reply.badRequest('Invalid cursor');
      }

      // Build query - filter by userId
      const conditions: ReturnType<typeof eq>[] = [eq(accounts.userId, userId)];

      // Apply cursor for pagination
      if (cursorData) {
        conditions.push(
          or(
            lt(accounts.createdAt, cursorData.createdAt),
            and(
              eq(accounts.createdAt, cursorData.createdAt),
              lt(accounts.id, cursorData.id)
            )
          )
        );
      }

      // Apply search filter
      if (q) {
        const searchTerm = `%${q.toLowerCase()}%`;
        conditions.push(
          or(
            drizzleSql`LOWER(${accounts.name}) LIKE ${searchTerm}`,
            drizzleSql`LOWER(${accounts.institution}) LIKE ${searchTerm}`
          )
        );
      }

      // Fetch limit + 1 to check for next page
      const query = db
        .select()
        .from(accounts)
        .orderBy(desc(accounts.createdAt), desc(accounts.id))
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
      request.log.error({ error }, 'Failed to list accounts');
      return reply.internalError();
    }
  });

  /**
   * GET /v1/accounts/:id
   * Get a single account by ID
   */
  fastify.get<{ Params: { id: string } }>(
    '/accounts/:id',
    async (request, reply) => {
      try {
        // For now, use a default test user ID
        // TODO: Replace with actual authentication when auth routes are ready
        const userId = 'test-user-id';

        // Validate ID
        const validation = fastify.safeValidate(
          accountIdSchema,
          request.params.id
        );

        if (!validation.success) {
          return reply.badRequest(
            'Invalid account ID',
            'errors' in validation ? validation.errors : []
          );
        }

        const db = await getDb();
        const [account] = await db
          .select()
          .from(accounts)
          .where(
            and(eq(accounts.id, request.params.id), eq(accounts.userId, userId))
          );

        if (!account) {
          return reply.notFound('Account', request.params.id);
        }

        return reply.send({ data: account });
      } catch (error) {
        request.log.error({ error }, 'Failed to get account');
        return reply.internalError();
      }
    }
  );

  /**
   * PATCH /v1/accounts/:id
   * Update an account
   */
  fastify.patch<{ Params: { id: string } }>(
    '/accounts/:id',
    async (request, reply) => {
      try {
        // For now, use a default test user ID
        // TODO: Replace with actual authentication when auth routes are ready
        const userId = 'test-user-id';

        // Validate ID
        const idValidation = fastify.safeValidate(
          accountIdSchema,
          request.params.id
        );

        if (!idValidation.success) {
          return reply.badRequest(
            'Invalid account ID',
            'errors' in idValidation ? idValidation.errors : []
          );
        }

        // Validate body
        const bodyValidation = fastify.safeValidate(
          updateAccountSchema,
          request.body
        );

        if (!bodyValidation.success) {
          return reply.badRequest(
            'Invalid request body',
            'errors' in bodyValidation ? bodyValidation.errors : []
          );
        }

        const data = bodyValidation.data;
        const db = await getDb();

        // Check if account exists and belongs to user
        const [existing] = await db
          .select()
          .from(accounts)
          .where(
            and(eq(accounts.id, request.params.id), eq(accounts.userId, userId))
          );

        if (!existing) {
          return reply.notFound('Account', request.params.id);
        }

        // Build update object with only provided fields
        const updates: {
          name?: string;
          institution?: string;
          type?: 'checking' | 'savings' | 'credit' | 'cash';
        } = {};
        if (data.name !== undefined) updates.name = data.name;
        if (data.institution !== undefined)
          updates.institution = data.institution;
        if (data.type !== undefined) updates.type = data.type;

        // Perform update if there are changes
        if (Object.keys(updates).length > 0) {
          await db
            .update(accounts)
            .set(updates)
            .where(
              and(
                eq(accounts.id, request.params.id),
                eq(accounts.userId, userId)
              )
            );
        }

        // Fetch updated account
        const [account] = await db
          .select()
          .from(accounts)
          .where(
            and(eq(accounts.id, request.params.id), eq(accounts.userId, userId))
          );

        const responseBody = { data: account };
        fastify.cacheIdempotentResponse(request, reply, responseBody);

        return reply.send(responseBody);
      } catch (error) {
        request.log.error({ error }, 'Failed to update account');
        return reply.internalError();
      }
    }
  );

  /**
   * DELETE /v1/accounts/:id
   * Delete an account
   */
  fastify.delete<{ Params: { id: string } }>(
    '/accounts/:id',
    async (request, reply) => {
      try {
        // For now, use a default test user ID
        // TODO: Replace with actual authentication when auth routes are ready
        const userId = 'test-user-id';

        // Validate ID
        const validation = fastify.safeValidate(
          accountIdSchema,
          request.params.id
        );

        if (!validation.success) {
          return reply.badRequest(
            'Invalid account ID',
            'errors' in validation ? validation.errors : []
          );
        }

        const db = await getDb();

        // Check if account exists and belongs to user
        const [existing] = await db
          .select()
          .from(accounts)
          .where(
            and(eq(accounts.id, request.params.id), eq(accounts.userId, userId))
          );

        if (!existing) {
          return reply.notFound('Account', request.params.id);
        }

        // Delete account
        await db
          .delete(accounts)
          .where(
            and(eq(accounts.id, request.params.id), eq(accounts.userId, userId))
          );

        // Cache empty response for idempotency
        fastify.cacheIdempotentResponse(request, reply, null);

        return reply.code(204).send();
      } catch (error) {
        request.log.error({ error }, 'Failed to delete account');
        return reply.internalError();
      }
    }
  );
};

export default accountsRoutes;
