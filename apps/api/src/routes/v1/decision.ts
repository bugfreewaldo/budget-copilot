/**
 * Decision Engine Routes
 * The core product endpoint
 */

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import {
  getOrComputeDecision,
  acknowledgeDecision,
  getLastLockedDecision,
} from '../../services/decision-engine/index.js';

const decisionRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /v1/decision
   * Get current decision for authenticated user
   * Returns cached decision if valid, computes new one if expired
   */
  fastify.get('/decision', async (request, reply) => {
    try {
      // Get user from auth (fallback to test user for now)
      const userId =
        (request as unknown as { userId?: string }).userId || 'test-user-id';
      const user = (request as unknown as { user?: { plan: string } }).user;
      const userPlan = user?.plan || 'free';

      // Check for expired decision
      const hasExpiredDecision = await getLastLockedDecision(userId);

      // Get or compute decision
      const { decision, state, hoursRemaining } =
        await getOrComputeDecision(userId);

      // For free users: return anxiety, not answers
      if (userPlan === 'free') {
        return reply.send({
          data: {
            id: state.id,
            isPaid: false,
            riskLevel: decision.riskLevel,
            // Vague warnings only - no specifics
            warnings: decision.warnings.map((w) => {
              // Strip numbers and specifics
              if (w.includes('due in')) {
                const match = w.match(/due in (\d+)/);
                if (match) {
                  return `Bill due in ${match[1]} days`;
                }
              }
              if (w.includes('Debt-free')) {
                return 'A debt payoff date was calculated';
              }
              if (w.includes('Runway')) {
                return 'Your runway needs attention';
              }
              return 'Financial action required';
            }),
            // The anxiety line
            teaser: 'Your next financial action is ready.',
            hasExpiredDecision,
            hoursRemaining: 0, // Don't show countdown to free users
          },
        });
      }

      // For paid users: full decision
      return reply.send({
        data: {
          id: state.id,
          isPaid: true,
          riskLevel: decision.riskLevel,
          primaryCommand: {
            type: decision.primaryCommand.type,
            text: decision.primaryCommand.text,
            amountCents: decision.primaryCommand.amountCents,
            target: decision.primaryCommand.target,
            date: decision.primaryCommand.date,
          },
          warnings: decision.warnings,
          nextAction: decision.nextAction,
          hoursRemaining,
          hasExpiredDecision,
          computedAt: state.computedAt,
          expiresAt: state.expiresAt,
          // Context for "Why?" drawer (no formulas, just facts)
          context: {
            cashAvailable: decision.basis.cashAvailable,
            daysUntilPay: decision.basis.daysUntilPay,
            upcomingBillsTotal: decision.basis.upcomingBillsTotal,
            runwayDays: decision.basis.runwayDays,
          },
        },
      });
    } catch (error) {
      request.log.error({ error }, 'Failed to get decision');
      return reply.internalError();
    }
  });

  /**
   * POST /v1/decision/acknowledge
   * Mark that user saw and acknowledged the decision
   */
  fastify.post('/decision/acknowledge', async (request, reply) => {
    try {
      const schema = z.object({
        decisionId: z.string().min(1),
      });

      const validation = fastify.safeValidate(schema, request.body);
      if (!validation.success) {
        return reply.badRequest(
          'Invalid request body',
          'errors' in validation ? validation.errors : []
        );
      }

      await acknowledgeDecision(validation.data.decisionId);

      return reply.send({ success: true });
    } catch (error) {
      request.log.error({ error }, 'Failed to acknowledge decision');
      return reply.internalError();
    }
  });
};

export default decisionRoutes;
