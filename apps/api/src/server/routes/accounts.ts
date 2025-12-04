import type { FastifyPluginAsync } from 'fastify';
import { getDb, saveDatabase } from '../../db/client.js';
import { createAccountSchema } from '../schemas/accounts.js';
import { createErrorResponse, formatZodError } from '../schemas/common.js';
import * as accountRepo from '../lib/repo/accounts.js';

/**
 * Account routes
 * GET /v1/accounts - List all accounts
 * POST /v1/accounts - Create new account
 */
export const accountRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /v1/accounts - List all accounts
  fastify.get('/accounts', async (request, reply) => {
    try {
      const db = await getDb();
      const accounts = await accountRepo.findAllAccounts(db);

      return reply.send({ data: accounts });
    } catch (error) {
      request.log.error({ error }, 'Failed to list accounts');
      return reply.status(500).send(
        createErrorResponse(
          'DB_ERROR',
          'Failed to retrieve accounts',
          { error: (error as Error).message }
        )
      );
    }
  });

  // POST /v1/accounts - Create new account
  fastify.post('/accounts', async (request, reply) => {
    try {
      // Validate request body
      const validation = createAccountSchema.safeParse(request.body);

      if (!validation.success) {
        return reply.status(400).send(formatZodError(validation.error));
      }

      const db = await getDb();
      const account = await accountRepo.createAccount(db, validation.data);

      // Save database after mutation
      saveDatabase();

      request.log.info({ accountId: account?.id }, 'Account created');

      return reply.status(201).send({ data: account });
    } catch (error) {
      request.log.error({ error }, 'Failed to create account');
      return reply.status(500).send(
        createErrorResponse(
          'DB_ERROR',
          'Failed to create account',
          { error: (error as Error).message }
        )
      );
    }
  });
};
