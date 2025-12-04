import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import * as copilotService from '../../services/transaction-copilot/index.js';

/**
 * Copilot V1 Routes
 * Conversational AI for adding transactions through natural language
 */

// ============================================================================
// Validation Schemas
// ============================================================================

const chatMessageSchema = z.object({
  message: z.string().min(1, 'Message is required').max(1000),
  conversationHistory: z
    .array(
      z.object({
        role: z.enum(['system', 'user', 'assistant']),
        content: z.string(),
      })
    )
    .optional()
    .default([]),
});

const updateCategorySchema = z.object({
  transactionId: z.string().min(1),
  categoryId: z.string().min(1),
});

// ============================================================================
// Route Handlers
// ============================================================================

const copilotRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * POST /v1/copilot/chat
   * Send a message to the transaction copilot
   */
  fastify.post('/copilot/chat', async (request, reply) => {
    try {
      // Validate request body
      const validation = fastify.safeValidate(chatMessageSchema, request.body);

      if (!validation.success) {
        return reply.badRequest('Invalid request body', validation.errors);
      }

      const { message, conversationHistory } = validation.data;

      // Get user ID from auth context (using test user for now)
      const userId = request.userId || 'test-user-00000000000000000001';

      // Process message through copilot service
      const response = await copilotService.processMessage(
        userId,
        message,
        conversationHistory
      );

      return reply.send({
        data: response,
      });
    } catch (error) {
      request.log.error({ error }, 'Failed to process copilot message');
      return reply.internalError();
    }
  });

  /**
   * POST /v1/copilot/update-category
   * Update the category of a recently created transaction
   */
  fastify.post('/copilot/update-category', async (request, reply) => {
    try {
      // Validate request body
      const validation = fastify.safeValidate(
        updateCategorySchema,
        request.body
      );

      if (!validation.success) {
        return reply.badRequest('Invalid request body', validation.errors);
      }

      const { transactionId, categoryId } = validation.data;

      // Get user ID from auth context
      const userId = request.userId || 'test-user-00000000000000000001';

      const success = await copilotService.updateTransactionCategory(
        transactionId,
        categoryId,
        userId
      );

      if (!success) {
        return reply.notFound('Transaction', transactionId);
      }

      return reply.send({
        data: { success: true },
      });
    } catch (error) {
      request.log.error({ error }, 'Failed to update transaction category');
      return reply.internalError();
    }
  });

  /**
   * GET /v1/copilot/quick-actions
   * Get suggested quick actions for the copilot UI
   */
  fastify.get('/copilot/quick-actions', async (request, reply) => {
    try {
      const quickActions = copilotService.getQuickActions();

      return reply.send({
        data: quickActions,
      });
    } catch (error) {
      request.log.error({ error }, 'Failed to get quick actions');
      return reply.internalError();
    }
  });
};

export default copilotRoutes;
