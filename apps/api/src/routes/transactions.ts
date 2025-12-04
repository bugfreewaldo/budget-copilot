import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { getProvider } from '@budget-copilot/ai';
import { redactTransactions } from '@budget-copilot/ai/redaction';

/**
 * Transaction-related routes
 */

const summarizeRequestSchema = z.object({
  transactions: z.array(
    z.object({
      date: z.string().or(z.date()),
      description: z.string(),
      amount: z.number(),
    })
  ),
  prompt: z.string().optional(),
});

export const transactionRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * POST /v1/summarize-transactions
   * Summarize transactions using AI with PII redaction
   */
  fastify.post('/summarize-transactions', async (request, reply) => {
    try {
      // Validate request body
      const body = summarizeRequestSchema.parse(request.body);

      // Redact PII from transactions
      const safeTransactions = redactTransactions(body.transactions);

      // Build prompt
      const transactionList = safeTransactions
        .map(
          (txn) =>
            `${txn.date}: ${txn.description} - $${Math.abs(txn.amount).toFixed(2)}`
        )
        .join('\n');

      const defaultPrompt = `Analyze these recent transactions and provide:
1. Key spending categories
2. Notable patterns or trends
3. Any suggestions for better budgeting

Transactions:
${transactionList}`;

      const prompt = body.prompt || defaultPrompt;

      // Get AI provider and generate summary
      try {
        const provider = getProvider();

        if (!provider.isConfigured()) {
          return reply.status(503).send({
            error: 'AI provider not configured',
            message:
              'Please set OPENAI_API_KEY or ANTHROPIC_API_KEY in environment variables',
          });
        }

        const result = await provider.complete(prompt, {
          temperature: 0.7,
          maxTokens: 500,
        });

        return {
          summary: result.text,
          transactionCount: body.transactions.length,
          model: result.model,
        };
      } catch (providerError) {
        fastify.log.error({ providerError }, 'AI provider error');

        // Return stub response if AI is not available
        return {
          summary:
            'AI summarization is currently unavailable. Your transactions have been recorded successfully.',
          transactionCount: body.transactions.length,
          model: 'stub',
          note: 'This is a fallback response. Please configure AI provider for intelligent summaries.',
        };
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'Validation error',
          details: error.errors,
        });
      }

      fastify.log.error({ error }, 'Error summarizing transactions');
      return reply.status(500).send({
        error: 'Internal server error',
      });
    }
  });
};
