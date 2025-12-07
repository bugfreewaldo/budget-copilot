import type { FastifyPluginAsync } from 'fastify';
import { getDb, saveDatabase } from '../../db/client.js';
import { requireAuth } from '../plugins/auth.js';
import {
  createTransactionSchema,
  updateTransactionSchema,
  listTransactionsQuerySchema,
} from '../schemas/transactions.js';
import {
  createErrorResponse,
  formatZodError,
  idSchema,
} from '../schemas/common.js';
import * as transactionRepo from '../lib/repo/transactions.js';

/**
 * Transaction routes
 * GET /v1/transactions - List transactions with filters
 * POST /v1/transactions - Create new transaction
 * PATCH /v1/transactions/:id - Update transaction
 * DELETE /v1/transactions/:id - Delete transaction
 */
export const transactionRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /v1/transactions - List transactions for current user
  fastify.get(
    '/transactions',
    { preHandler: requireAuth },
    async (request, reply) => {
      try {
        // Validate query params
        const validation = listTransactionsQuerySchema.safeParse(request.query);

        if (!validation.success) {
          return reply.status(400).send(formatZodError(validation.error));
        }

        const db = await getDb();
        const userId = request.user!.id;
        const transactions = await transactionRepo.findAllTransactions(db, {
          ...validation.data,
          userId,
        });

        return reply.send({ data: transactions });
      } catch (error) {
        request.log.error({ error }, 'Failed to list transactions');
        return reply.status(500).send(
          createErrorResponse('DB_ERROR', 'Failed to retrieve transactions', {
            error: (error as Error).message,
          })
        );
      }
    }
  );

  // POST /v1/transactions - Create new transaction
  fastify.post(
    '/transactions',
    { preHandler: requireAuth },
    async (request, reply) => {
      try {
        // Validate request body
        const validation = createTransactionSchema.safeParse(request.body);

        if (!validation.success) {
          return reply.status(400).send(formatZodError(validation.error));
        }

        const db = await getDb();
        const userId = request.user!.id;
        const transaction = await transactionRepo.createTransaction(db, {
          ...validation.data,
          userId,
        });

        // Save database after mutation
        saveDatabase();

        request.log.info(
          {
            transactionId: transaction?.id,
            amountCents: transaction?.amountCents,
          },
          'Transaction created'
        );

        return reply.status(201).send({ data: transaction });
      } catch (error) {
        request.log.error({ error }, 'Failed to create transaction');
        return reply.status(500).send(
          createErrorResponse('DB_ERROR', 'Failed to create transaction', {
            error: (error as Error).message,
          })
        );
      }
    }
  );

  // PATCH /v1/transactions/:id - Update transaction
  fastify.patch<{ Params: { id: string } }>(
    '/transactions/:id',
    { preHandler: requireAuth },
    async (request, reply) => {
      try {
        // Validate ID param
        const idValidation = idSchema.safeParse(request.params.id);
        if (!idValidation.success) {
          return reply
            .status(400)
            .send(
              createErrorResponse('VALIDATION_ERROR', 'Invalid transaction ID')
            );
        }

        // Validate request body
        const validation = updateTransactionSchema.safeParse(request.body);

        if (!validation.success) {
          return reply.status(400).send(formatZodError(validation.error));
        }

        const db = await getDb();
        const userId = request.user!.id;

        // Check if transaction exists and belongs to current user
        const existing = await transactionRepo.findTransactionById(
          db,
          idValidation.data
        );

        if (!existing || existing.userId !== userId) {
          return reply
            .status(404)
            .send(createErrorResponse('NOT_FOUND', 'Transaction not found'));
        }

        const transaction = await transactionRepo.updateTransaction(
          db,
          idValidation.data,
          validation.data
        );

        // Save database after mutation
        saveDatabase();

        request.log.info(
          { transactionId: idValidation.data },
          'Transaction updated'
        );

        return reply.send({ data: transaction });
      } catch (error) {
        request.log.error({ error }, 'Failed to update transaction');
        return reply.status(500).send(
          createErrorResponse('DB_ERROR', 'Failed to update transaction', {
            error: (error as Error).message,
          })
        );
      }
    }
  );

  // DELETE /v1/transactions/:id - Delete transaction
  fastify.delete<{ Params: { id: string } }>(
    '/transactions/:id',
    { preHandler: requireAuth },
    async (request, reply) => {
      try {
        // Validate ID param
        const idValidation = idSchema.safeParse(request.params.id);
        if (!idValidation.success) {
          return reply
            .status(400)
            .send(
              createErrorResponse('VALIDATION_ERROR', 'Invalid transaction ID')
            );
        }

        const db = await getDb();
        const userId = request.user!.id;

        // Check if transaction exists and belongs to current user
        const existing = await transactionRepo.findTransactionById(
          db,
          idValidation.data
        );

        if (!existing || existing.userId !== userId) {
          return reply
            .status(404)
            .send(createErrorResponse('NOT_FOUND', 'Transaction not found'));
        }

        await transactionRepo.deleteTransaction(db, idValidation.data);

        // Save database after mutation
        saveDatabase();

        request.log.info(
          { transactionId: idValidation.data },
          'Transaction deleted'
        );

        return reply.status(204).send();
      } catch (error) {
        request.log.error({ error }, 'Failed to delete transaction');
        return reply.status(500).send(
          createErrorResponse('DB_ERROR', 'Failed to delete transaction', {
            error: (error as Error).message,
          })
        );
      }
    }
  );
};
