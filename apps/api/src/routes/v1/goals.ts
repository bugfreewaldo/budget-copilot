import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { getDb } from '../../db/client.js';
import { goals } from '../../db/schema.js';
import { eq, and, asc, gt, or, desc } from 'drizzle-orm';
import { nanoid } from 'nanoid';

/**
 * Goals V1 Routes - Seguimiento de Metas
 * Full CRUD for financial goal tracking
 */

// ============================================================================
// Validation Schemas
// ============================================================================

const goalTypeEnum = z.enum([
  'savings',
  'debt_payoff',
  'purchase',
  'emergency_fund',
  'investment',
  'other',
]);

const goalStatusEnum = z.enum(['active', 'completed', 'paused', 'abandoned']);

export const createGoalSchema = z.object({
  name: z.string().min(1).max(64),
  description: z.string().max(256).optional(),
  emoji: z.string().max(4).optional(),
  target_amount_cents: z.number().int().positive(),
  current_amount_cents: z.number().int().min(0).optional().default(0),
  target_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  goal_type: goalTypeEnum,
  linked_debt_id: z.string().min(1).nullable().optional(),
  linked_account_id: z.string().min(1).nullable().optional(),
});

export const updateGoalSchema = z.object({
  name: z.string().min(1).max(64).optional(),
  description: z.string().max(256).optional(),
  emoji: z.string().max(4).optional(),
  target_amount_cents: z.number().int().positive().optional(),
  current_amount_cents: z.number().int().min(0).optional(),
  target_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  status: goalStatusEnum.optional(),
});

export const contributeSchema = z.object({
  amount_cents: z.number().int().positive(),
});

export const listGoalsQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  status: goalStatusEnum.optional(),
  type: goalTypeEnum.optional(),
});

export const goalIdSchema = z.string().min(1);

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Calculate progress percentage and on-track status
 */
function calculateProgress(
  currentCents: number,
  targetCents: number,
  startDate: string,
  targetDate: string | null
): {
  progressPercent: number;
  onTrack: boolean;
  projectedCompletionDate: string | null;
  recommendedMonthlyCents: number;
} {
  const progressPercent = Math.min((currentCents / targetCents) * 100, 100);

  if (!targetDate) {
    return {
      progressPercent,
      onTrack: true,
      projectedCompletionDate: null,
      recommendedMonthlyCents: 0,
    };
  }

  const now = new Date();
  const start = new Date(startDate);
  const target = new Date(targetDate);

  // Calculate expected progress based on time elapsed
  const totalDays =
    (target.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
  const elapsedDays = (now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
  const expectedProgress = (elapsedDays / totalDays) * 100;

  const onTrack = progressPercent >= expectedProgress * 0.9; // Within 90% of expected

  // Calculate projected completion date based on current rate
  const remainingCents = targetCents - currentCents;
  const daysElapsed = Math.max(elapsedDays, 1);
  const dailyRate = currentCents / daysElapsed;

  let projectedCompletionDate: string | null = null;
  if (dailyRate > 0) {
    const daysToComplete = remainingCents / dailyRate;
    const projected = new Date();
    projected.setDate(projected.getDate() + Math.ceil(daysToComplete));
    projectedCompletionDate = projected.toISOString().split('T')[0];
  }

  // Calculate recommended monthly contribution
  const remainingMonths = Math.max(
    (target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 30),
    1
  );
  const recommendedMonthlyCents = Math.ceil(remainingCents / remainingMonths);

  return {
    progressPercent,
    onTrack,
    projectedCompletionDate,
    recommendedMonthlyCents,
  };
}

// ============================================================================
// Route Handlers
// ============================================================================

const goalsRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * POST /v1/goals
   * Create a new goal
   */
  fastify.post('/goals', async (request, reply) => {
    try {
      const validation = fastify.safeValidate(createGoalSchema, request.body);

      if (!validation.success) {
        return reply.badRequest('Invalid request body', validation.errors);
      }

      const data = validation.data;
      const db = await getDb();

      const id = nanoid();
      const now = Date.now();
      const startDate = new Date().toISOString().split('T')[0];

      // Calculate initial progress
      const progress = calculateProgress(
        data.current_amount_cents || 0,
        data.target_amount_cents,
        startDate,
        data.target_date || null
      );

      await db.insert(goals).values({
        id,
        name: data.name,
        description: data.description || null,
        emoji: data.emoji || null,
        targetAmountCents: data.target_amount_cents,
        currentAmountCents: data.current_amount_cents || 0,
        targetDate: data.target_date || null,
        startDate,
        goalType: data.goal_type,
        linkedDebtId: data.linked_debt_id || null,
        linkedAccountId: data.linked_account_id || null,
        progressPercent: progress.progressPercent,
        onTrack: progress.onTrack,
        projectedCompletionDate: progress.projectedCompletionDate,
        recommendedMonthlyCents: progress.recommendedMonthlyCents,
        status: 'active',
        createdAt: now,
        updatedAt: now,
      });

      const [goal] = await db.select().from(goals).where(eq(goals.id, id));

      reply.code(201);
      const responseBody = { data: goal };
      fastify.cacheIdempotentResponse(request, reply, responseBody);
      return reply.send(responseBody);
    } catch (error) {
      request.log.error({ error }, 'Failed to create goal');
      return reply.internalError();
    }
  });

  /**
   * GET /v1/goals
   * List goals with cursor-based pagination
   */
  fastify.get('/goals', async (request, reply) => {
    try {
      const validation = fastify.safeValidate(
        listGoalsQuerySchema,
        request.query
      );

      if (!validation.success) {
        return reply.badRequest('Invalid query parameters', validation.errors);
      }

      const { cursor, limit, status, type } = validation.data;
      const db = await getDb();

      const cursorData = cursor ? fastify.decodeCursor(cursor) : null;

      if (cursor && !cursorData) {
        return reply.badRequest('Invalid cursor');
      }

      const conditions: any[] = [];

      if (cursorData) {
        conditions.push(
          or(
            gt(goals.createdAt, cursorData.createdAt),
            and(
              eq(goals.createdAt, cursorData.createdAt),
              gt(goals.id, cursorData.id)
            )
          )
        );
      }

      if (status) {
        conditions.push(eq(goals.status, status));
      }

      if (type) {
        conditions.push(eq(goals.goalType, type));
      }

      const query = db
        .select()
        .from(goals)
        .orderBy(
          desc(goals.progressPercent),
          asc(goals.createdAt),
          asc(goals.id)
        )
        .limit(limit + 1);

      if (conditions.length > 0) {
        query.where(and(...conditions));
      }

      const results = await query;

      // Calculate summary stats
      const allActiveGoals = await db
        .select()
        .from(goals)
        .where(eq(goals.status, 'active'));
      const totalTargetCents = allActiveGoals.reduce(
        (sum, g) => sum + g.targetAmountCents,
        0
      );
      const totalCurrentCents = allActiveGoals.reduce(
        (sum, g) => sum + g.currentAmountCents,
        0
      );
      const onTrackCount = allActiveGoals.filter((g) => g.onTrack).length;

      const response = fastify.createPaginatedResponse(
        results,
        limit,
        (item) => item.createdAt,
        (item) => item.id
      );

      return reply.send({
        ...response,
        summary: {
          activeCount: allActiveGoals.length,
          totalTargetCents,
          totalCurrentCents,
          overallProgressPercent:
            totalTargetCents > 0
              ? (totalCurrentCents / totalTargetCents) * 100
              : 0,
          onTrackCount,
        },
      });
    } catch (error) {
      request.log.error({ error }, 'Failed to list goals');
      return reply.internalError();
    }
  });

  /**
   * GET /v1/goals/:id
   * Get a single goal by ID
   */
  fastify.get<{ Params: { id: string } }>(
    '/goals/:id',
    async (request, reply) => {
      try {
        const validation = fastify.safeValidate(
          goalIdSchema,
          request.params.id
        );

        if (!validation.success) {
          return reply.badRequest('Invalid goal ID', validation.errors);
        }

        const db = await getDb();
        const [goal] = await db
          .select()
          .from(goals)
          .where(eq(goals.id, request.params.id));

        if (!goal) {
          return reply.notFound('Goal', request.params.id);
        }

        return reply.send({ data: goal });
      } catch (error) {
        request.log.error({ error }, 'Failed to get goal');
        return reply.internalError();
      }
    }
  );

  /**
   * PATCH /v1/goals/:id
   * Update a goal
   */
  fastify.patch<{ Params: { id: string } }>(
    '/goals/:id',
    async (request, reply) => {
      try {
        const idValidation = fastify.safeValidate(
          goalIdSchema,
          request.params.id
        );

        if (!idValidation.success) {
          return reply.badRequest('Invalid goal ID', idValidation.errors);
        }

        const bodyValidation = fastify.safeValidate(
          updateGoalSchema,
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

        const [existing] = await db
          .select()
          .from(goals)
          .where(eq(goals.id, request.params.id));

        if (!existing) {
          return reply.notFound('Goal', request.params.id);
        }

        const updates: any = { updatedAt: Date.now() };
        if (data.name !== undefined) updates.name = data.name;
        if (data.description !== undefined)
          updates.description = data.description;
        if (data.emoji !== undefined) updates.emoji = data.emoji;
        if (data.target_amount_cents !== undefined)
          updates.targetAmountCents = data.target_amount_cents;
        if (data.current_amount_cents !== undefined)
          updates.currentAmountCents = data.current_amount_cents;
        if (data.target_date !== undefined)
          updates.targetDate = data.target_date;
        if (data.status !== undefined) {
          updates.status = data.status;
          if (data.status === 'completed') {
            updates.completedAt = Date.now();
          }
        }

        // Recalculate progress
        const currentCents =
          data.current_amount_cents ?? existing.currentAmountCents;
        const targetCents =
          data.target_amount_cents ?? existing.targetAmountCents;
        const targetDate =
          data.target_date !== undefined
            ? data.target_date
            : existing.targetDate;

        const progress = calculateProgress(
          currentCents,
          targetCents,
          existing.startDate,
          targetDate
        );

        updates.progressPercent = progress.progressPercent;
        updates.onTrack = progress.onTrack;
        updates.projectedCompletionDate = progress.projectedCompletionDate;
        updates.recommendedMonthlyCents = progress.recommendedMonthlyCents;

        // Auto-complete if reached target
        if (currentCents >= targetCents && existing.status === 'active') {
          updates.status = 'completed';
          updates.completedAt = Date.now();
        }

        await db
          .update(goals)
          .set(updates)
          .where(eq(goals.id, request.params.id));

        const [goal] = await db
          .select()
          .from(goals)
          .where(eq(goals.id, request.params.id));

        const responseBody = { data: goal };
        fastify.cacheIdempotentResponse(request, reply, responseBody);
        return reply.send(responseBody);
      } catch (error) {
        request.log.error({ error }, 'Failed to update goal');
        return reply.internalError();
      }
    }
  );

  /**
   * POST /v1/goals/:id/contribute
   * Add money towards a goal
   */
  fastify.post<{ Params: { id: string } }>(
    '/goals/:id/contribute',
    async (request, reply) => {
      try {
        const idValidation = fastify.safeValidate(
          goalIdSchema,
          request.params.id
        );

        if (!idValidation.success) {
          return reply.badRequest('Invalid goal ID', idValidation.errors);
        }

        const bodyValidation = fastify.safeValidate(
          contributeSchema,
          request.body
        );

        if (!bodyValidation.success) {
          return reply.badRequest(
            'Invalid request body',
            bodyValidation.errors
          );
        }

        const { amount_cents } = bodyValidation.data;
        const db = await getDb();

        const [existing] = await db
          .select()
          .from(goals)
          .where(eq(goals.id, request.params.id));

        if (!existing) {
          return reply.notFound('Goal', request.params.id);
        }

        if (existing.status !== 'active') {
          return reply.badRequest('Cannot contribute to a non-active goal');
        }

        const newAmount = existing.currentAmountCents + amount_cents;

        // Recalculate progress
        const progress = calculateProgress(
          newAmount,
          existing.targetAmountCents,
          existing.startDate,
          existing.targetDate
        );

        const updates: any = {
          currentAmountCents: newAmount,
          progressPercent: progress.progressPercent,
          onTrack: progress.onTrack,
          projectedCompletionDate: progress.projectedCompletionDate,
          recommendedMonthlyCents: progress.recommendedMonthlyCents,
          updatedAt: Date.now(),
        };

        // Auto-complete if reached target
        if (newAmount >= existing.targetAmountCents) {
          updates.status = 'completed';
          updates.completedAt = Date.now();
        }

        await db
          .update(goals)
          .set(updates)
          .where(eq(goals.id, request.params.id));

        const [goal] = await db
          .select()
          .from(goals)
          .where(eq(goals.id, request.params.id));

        const responseBody = {
          data: goal,
          contribution: {
            amountCents: amount_cents,
            newTotalCents: newAmount,
            isCompleted: newAmount >= existing.targetAmountCents,
          },
        };
        fastify.cacheIdempotentResponse(request, reply, responseBody);
        return reply.send(responseBody);
      } catch (error) {
        request.log.error({ error }, 'Failed to contribute to goal');
        return reply.internalError();
      }
    }
  );

  /**
   * DELETE /v1/goals/:id
   * Delete a goal
   */
  fastify.delete<{ Params: { id: string } }>(
    '/goals/:id',
    async (request, reply) => {
      try {
        const validation = fastify.safeValidate(
          goalIdSchema,
          request.params.id
        );

        if (!validation.success) {
          return reply.badRequest('Invalid goal ID', validation.errors);
        }

        const db = await getDb();

        const [existing] = await db
          .select()
          .from(goals)
          .where(eq(goals.id, request.params.id));

        if (!existing) {
          return reply.notFound('Goal', request.params.id);
        }

        await db.delete(goals).where(eq(goals.id, request.params.id));

        fastify.cacheIdempotentResponse(request, reply, null);
        return reply.code(204).send();
      } catch (error) {
        request.log.error({ error }, 'Failed to delete goal');
        return reply.internalError();
      }
    }
  );
};

export default goalsRoutes;
