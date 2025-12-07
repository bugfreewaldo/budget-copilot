import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { getDb } from '../../db/client.js';
import { debts, debtPayments } from '../../db/schema.js';
import { eq, and, asc, gt, or, desc } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { requireAuth } from '../../server/plugins/auth.js';

/**
 * Debts V1 Routes - Copiloto de Deudas
 * Full CRUD for debt tracking with payoff projections
 */

// ============================================================================
// Validation Schemas
// ============================================================================

const debtTypeEnum = z.enum([
  'credit_card',
  'personal_loan',
  'auto_loan',
  'mortgage',
  'student_loan',
  'medical',
  'other',
]);

const debtStatusEnum = z.enum(['active', 'paid_off', 'defaulted', 'deferred']);

export const createDebtSchema = z.object({
  name: z.string().min(1).max(64),
  type: debtTypeEnum,
  original_balance_cents: z.number().int().positive(),
  current_balance_cents: z.number().int().min(0),
  apr_percent: z.number().min(0).max(100),
  minimum_payment_cents: z.number().int().min(0).optional(),
  due_day: z.number().int().min(1).max(31).optional(),
  account_id: z.string().min(1).nullable().optional(),
});

export const updateDebtSchema = z.object({
  name: z.string().min(1).max(64).optional(),
  type: debtTypeEnum.optional(),
  current_balance_cents: z.number().int().min(0).optional(),
  apr_percent: z.number().min(0).max(100).optional(),
  minimum_payment_cents: z.number().int().min(0).optional(),
  due_day: z.number().int().min(1).max(31).optional(),
  status: debtStatusEnum.optional(),
});

export const createPaymentSchema = z.object({
  amount_cents: z.number().int().positive(),
  principal_cents: z.number().int().min(0).optional(),
  interest_cents: z.number().int().min(0).optional(),
  payment_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const listDebtsQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  status: debtStatusEnum.optional(),
});

export const debtIdSchema = z.string().min(1);

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Calculate projected payoff date (death date) and total interest
 * Using simple amortization formula
 */
function calculateDebtProjections(
  balanceCents: number,
  aprPercent: number,
  monthlyPaymentCents: number
): { deathDate: string | null; totalInterestCents: number } {
  if (balanceCents <= 0 || monthlyPaymentCents <= 0) {
    return { deathDate: null, totalInterestCents: 0 };
  }

  const monthlyRate = aprPercent / 100 / 12;

  // If payment is too small to cover interest, can't pay off
  const monthlyInterest = balanceCents * monthlyRate;
  if (monthlyPaymentCents <= monthlyInterest) {
    return { deathDate: null, totalInterestCents: -1 }; // Infinite
  }

  // Calculate months to payoff
  let remainingBalance = balanceCents;
  let totalInterest = 0;
  let months = 0;
  const maxMonths = 360; // 30 years max

  while (remainingBalance > 0 && months < maxMonths) {
    const interest = Math.floor(remainingBalance * monthlyRate);
    totalInterest += interest;
    const principal = Math.min(
      monthlyPaymentCents - interest,
      remainingBalance
    );
    remainingBalance -= principal;
    months++;
  }

  // Calculate projected date
  const now = new Date();
  now.setMonth(now.getMonth() + months);
  const deathDate = now.toISOString().split('T')[0];

  return { deathDate, totalInterestCents: totalInterest };
}

/**
 * Calculate danger score (0-100) based on debt characteristics
 */
function calculateDangerScore(
  balanceCents: number,
  aprPercent: number,
  minimumPaymentCents: number,
  dueDay: number | null
): number {
  let score = 0;

  // High APR is dangerous (up to 40 points)
  score += Math.min(aprPercent * 2, 40);

  // High balance is concerning (up to 30 points)
  if (balanceCents > 1000000)
    score += 30; // > $10k
  else if (balanceCents > 500000)
    score += 20; // > $5k
  else if (balanceCents > 100000) score += 10; // > $1k

  // Minimum payment vs balance ratio (up to 20 points)
  if (minimumPaymentCents > 0) {
    const monthsToPayoff = balanceCents / minimumPaymentCents;
    if (monthsToPayoff > 120)
      score += 20; // > 10 years
    else if (monthsToPayoff > 60)
      score += 15; // > 5 years
    else if (monthsToPayoff > 24) score += 10; // > 2 years
  }

  // Due date approaching (up to 10 points)
  if (dueDay) {
    const today = new Date().getDate();
    const daysUntilDue = (dueDay - today + 31) % 31;
    if (daysUntilDue <= 3) score += 10;
    else if (daysUntilDue <= 7) score += 5;
  }

  return Math.min(Math.round(score), 100);
}

// ============================================================================
// Route Handlers
// ============================================================================

const debtsRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * POST /v1/debts
   * Create a new debt
   */
  fastify.post('/debts', { preHandler: requireAuth }, async (request, reply) => {
    try {
      const validation = fastify.safeValidate(createDebtSchema, request.body);

      if (!validation.success) {
        return reply.badRequest('Invalid request body', validation.errors);
      }

      const data = validation.data;
      const db = await getDb();
      const userId = request.user!.id;

      const id = nanoid();
      const now = Date.now();

      // Calculate projections
      const monthlyPayment = data.minimum_payment_cents || 0;
      const projections = calculateDebtProjections(
        data.current_balance_cents,
        data.apr_percent,
        monthlyPayment
      );

      const dangerScore = calculateDangerScore(
        data.current_balance_cents,
        data.apr_percent,
        monthlyPayment,
        data.due_day || null
      );

      // Calculate next due date
      let nextDueDate: string | null = null;
      if (data.due_day) {
        const today = new Date();
        const dueThisMonth = new Date(
          today.getFullYear(),
          today.getMonth(),
          data.due_day
        );
        if (dueThisMonth <= today) {
          dueThisMonth.setMonth(dueThisMonth.getMonth() + 1);
        }
        nextDueDate = dueThisMonth.toISOString().split('T')[0];
      }

      await db.insert(debts).values({
        id,
        userId,
        name: data.name,
        type: data.type,
        accountId: data.account_id || null,
        originalBalanceCents: data.original_balance_cents,
        currentBalanceCents: data.current_balance_cents,
        aprPercent: data.apr_percent,
        minimumPaymentCents: data.minimum_payment_cents || null,
        dueDay: data.due_day || null,
        nextDueDate,
        status: 'active',
        deathDate: projections.deathDate,
        totalInterestProjectedCents: projections.totalInterestCents,
        dangerScore,
        createdAt: now,
        updatedAt: now,
      });

      const [debt] = await db.select().from(debts).where(eq(debts.id, id));

      reply.code(201);
      const responseBody = { data: debt };
      fastify.cacheIdempotentResponse(request, reply, responseBody);
      return reply.send(responseBody);
    } catch (error) {
      request.log.error({ error }, 'Failed to create debt');
      return reply.internalError();
    }
  });

  /**
   * GET /v1/debts
   * List debts with cursor-based pagination
   */
  fastify.get('/debts', { preHandler: requireAuth }, async (request, reply) => {
    try {
      const validation = fastify.safeValidate(
        listDebtsQuerySchema,
        request.query
      );

      if (!validation.success) {
        return reply.badRequest('Invalid query parameters', validation.errors);
      }

      const { cursor, limit, status } = validation.data;
      const db = await getDb();
      const userId = request.user!.id;

      const cursorData = cursor ? fastify.decodeCursor(cursor) : null;

      if (cursor && !cursorData) {
        return reply.badRequest('Invalid cursor');
      }

      // Always filter by userId
      const conditions: any[] = [eq(debts.userId, userId)];

      // Apply cursor for pagination
      if (cursorData) {
        conditions.push(
          or(
            gt(debts.createdAt, cursorData.createdAt),
            and(
              eq(debts.createdAt, cursorData.createdAt),
              gt(debts.id, cursorData.id)
            )
          )
        );
      }

      // Filter by status
      if (status) {
        conditions.push(eq(debts.status, status));
      }

      const query = db
        .select()
        .from(debts)
        .orderBy(desc(debts.dangerScore), asc(debts.createdAt), asc(debts.id))
        .limit(limit + 1);

      if (conditions.length > 0) {
        query.where(and(...conditions));
      }

      const results = await query;

      // Calculate summary stats (filtered by userId)
      const allDebts = await db
        .select()
        .from(debts)
        .where(and(eq(debts.userId, userId), eq(debts.status, 'active')));
      const totalDebtCents = allDebts.reduce(
        (sum, d) => sum + d.currentBalanceCents,
        0
      );
      const totalMinPaymentCents = allDebts.reduce(
        (sum, d) => sum + (d.minimumPaymentCents || 0),
        0
      );

      const response = fastify.createPaginatedResponse(
        results,
        limit,
        (item) => item.createdAt,
        (item) => item.id
      );

      return reply.send({
        ...response,
        summary: {
          totalDebtCents,
          totalMinPaymentCents,
          activeCount: allDebts.length,
        },
      });
    } catch (error) {
      request.log.error({ error }, 'Failed to list debts');
      return reply.internalError();
    }
  });

  /**
   * GET /v1/debts/:id
   * Get a single debt by ID
   */
  fastify.get<{ Params: { id: string } }>(
    '/debts/:id',
    { preHandler: requireAuth },
    async (request, reply) => {
      try {
        const validation = fastify.safeValidate(
          debtIdSchema,
          request.params.id
        );

        if (!validation.success) {
          return reply.badRequest('Invalid debt ID', validation.errors);
        }

        const db = await getDb();
        const userId = request.user!.id;
        const [debt] = await db
          .select()
          .from(debts)
          .where(and(eq(debts.id, request.params.id), eq(debts.userId, userId)));

        if (!debt) {
          return reply.notFound('Debt', request.params.id);
        }

        // Get payment history
        const payments = await db
          .select()
          .from(debtPayments)
          .where(eq(debtPayments.debtId, request.params.id))
          .orderBy(desc(debtPayments.paymentDate));

        return reply.send({ data: { ...debt, payments } });
      } catch (error) {
        request.log.error({ error }, 'Failed to get debt');
        return reply.internalError();
      }
    }
  );

  /**
   * PATCH /v1/debts/:id
   * Update a debt
   */
  fastify.patch<{ Params: { id: string } }>(
    '/debts/:id',
    { preHandler: requireAuth },
    async (request, reply) => {
      try {
        const idValidation = fastify.safeValidate(
          debtIdSchema,
          request.params.id
        );

        if (!idValidation.success) {
          return reply.badRequest('Invalid debt ID', idValidation.errors);
        }

        const bodyValidation = fastify.safeValidate(
          updateDebtSchema,
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
        const userId = request.user!.id;

        const [existing] = await db
          .select()
          .from(debts)
          .where(and(eq(debts.id, request.params.id), eq(debts.userId, userId)));

        if (!existing) {
          return reply.notFound('Debt', request.params.id);
        }

        // Build updates
        const updates: any = { updatedAt: Date.now() };
        if (data.name !== undefined) updates.name = data.name;
        if (data.type !== undefined) updates.type = data.type;
        if (data.current_balance_cents !== undefined)
          updates.currentBalanceCents = data.current_balance_cents;
        if (data.apr_percent !== undefined)
          updates.aprPercent = data.apr_percent;
        if (data.minimum_payment_cents !== undefined)
          updates.minimumPaymentCents = data.minimum_payment_cents;
        if (data.due_day !== undefined) updates.dueDay = data.due_day;
        if (data.status !== undefined) updates.status = data.status;

        // Recalculate projections
        const balance =
          data.current_balance_cents ?? existing.currentBalanceCents;
        const apr = data.apr_percent ?? existing.aprPercent;
        const minPayment =
          data.minimum_payment_cents ?? existing.minimumPaymentCents ?? 0;
        const dueDay = data.due_day ?? existing.dueDay;

        const projections = calculateDebtProjections(balance, apr, minPayment);
        updates.deathDate = projections.deathDate;
        updates.totalInterestProjectedCents = projections.totalInterestCents;
        updates.dangerScore = calculateDangerScore(
          balance,
          apr,
          minPayment,
          dueDay
        );

        await db
          .update(debts)
          .set(updates)
          .where(eq(debts.id, request.params.id));

        const [debt] = await db
          .select()
          .from(debts)
          .where(eq(debts.id, request.params.id));

        const responseBody = { data: debt };
        fastify.cacheIdempotentResponse(request, reply, responseBody);
        return reply.send(responseBody);
      } catch (error) {
        request.log.error({ error }, 'Failed to update debt');
        return reply.internalError();
      }
    }
  );

  /**
   * POST /v1/debts/:id/payments
   * Record a payment towards a debt
   */
  fastify.post<{ Params: { id: string } }>(
    '/debts/:id/payments',
    { preHandler: requireAuth },
    async (request, reply) => {
      try {
        const idValidation = fastify.safeValidate(
          debtIdSchema,
          request.params.id
        );

        if (!idValidation.success) {
          return reply.badRequest('Invalid debt ID', idValidation.errors);
        }

        const bodyValidation = fastify.safeValidate(
          createPaymentSchema,
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
        const userId = request.user!.id;

        const [existing] = await db
          .select()
          .from(debts)
          .where(and(eq(debts.id, request.params.id), eq(debts.userId, userId)));

        if (!existing) {
          return reply.notFound('Debt', request.params.id);
        }

        const paymentId = nanoid();
        const now = Date.now();

        // Calculate principal/interest split if not provided
        let principalCents = data.principal_cents;
        let interestCents = data.interest_cents;

        if (principalCents === undefined || interestCents === undefined) {
          const monthlyRate = existing.aprPercent / 100 / 12;
          const estimatedInterest = Math.floor(
            existing.currentBalanceCents * monthlyRate
          );
          interestCents = Math.min(estimatedInterest, data.amount_cents);
          principalCents = data.amount_cents - interestCents;
        }

        // Insert payment record
        await db.insert(debtPayments).values({
          id: paymentId,
          debtId: request.params.id,
          amountCents: data.amount_cents,
          principalCents,
          interestCents,
          paymentDate: data.payment_date,
          createdAt: now,
        });

        // Update debt balance
        const newBalance = Math.max(
          0,
          existing.currentBalanceCents - principalCents
        );
        const newStatus = newBalance === 0 ? 'paid_off' : existing.status;

        const projections = calculateDebtProjections(
          newBalance,
          existing.aprPercent,
          existing.minimumPaymentCents || 0
        );

        await db
          .update(debts)
          .set({
            currentBalanceCents: newBalance,
            status: newStatus,
            deathDate: projections.deathDate,
            totalInterestProjectedCents: projections.totalInterestCents,
            dangerScore: calculateDangerScore(
              newBalance,
              existing.aprPercent,
              existing.minimumPaymentCents || 0,
              existing.dueDay
            ),
            updatedAt: now,
          })
          .where(eq(debts.id, request.params.id));

        const [payment] = await db
          .select()
          .from(debtPayments)
          .where(eq(debtPayments.id, paymentId));

        reply.code(201);
        const responseBody = { data: payment };
        fastify.cacheIdempotentResponse(request, reply, responseBody);
        return reply.send(responseBody);
      } catch (error) {
        request.log.error({ error }, 'Failed to record payment');
        return reply.internalError();
      }
    }
  );

  /**
   * DELETE /v1/debts/:id
   * Delete a debt
   */
  fastify.delete<{ Params: { id: string } }>(
    '/debts/:id',
    { preHandler: requireAuth },
    async (request, reply) => {
      try {
        const validation = fastify.safeValidate(
          debtIdSchema,
          request.params.id
        );

        if (!validation.success) {
          return reply.badRequest('Invalid debt ID', validation.errors);
        }

        const db = await getDb();
        const userId = request.user!.id;

        const [existing] = await db
          .select()
          .from(debts)
          .where(and(eq(debts.id, request.params.id), eq(debts.userId, userId)));

        if (!existing) {
          return reply.notFound('Debt', request.params.id);
        }

        // Delete payments first
        await db
          .delete(debtPayments)
          .where(eq(debtPayments.debtId, request.params.id));

        // Delete debt
        await db.delete(debts).where(eq(debts.id, request.params.id));

        fastify.cacheIdempotentResponse(request, reply, null);
        return reply.code(204).send();
      } catch (error) {
        request.log.error({ error }, 'Failed to delete debt');
        return reply.internalError();
      }
    }
  );

  /**
   * GET /v1/debts/strategies
   * Compare payoff strategies (avalanche vs snowball)
   */
  fastify.get('/debts/strategies', { preHandler: requireAuth }, async (request, reply) => {
    try {
      const db = await getDb();
      const userId = request.user!.id;
      const activeDebts = await db
        .select()
        .from(debts)
        .where(and(eq(debts.userId, userId), eq(debts.status, 'active')));

      if (activeDebts.length === 0) {
        return reply.send({
          data: {
            avalanche: { totalInterestCents: 0, monthsToPayoff: 0, order: [] },
            snowball: { totalInterestCents: 0, monthsToPayoff: 0, order: [] },
          },
        });
      }

      // Calculate total minimum payment (reserved for future use)
      const _totalMinPayment = activeDebts.reduce(
        (sum, d) => sum + (d.minimumPaymentCents || 0),
        0
      );

      // Avalanche: Pay highest APR first
      const avalancheOrder = [...activeDebts].sort(
        (a, b) => b.aprPercent - a.aprPercent
      );

      // Snowball: Pay smallest balance first
      const snowballOrder = [...activeDebts].sort(
        (a, b) => a.currentBalanceCents - b.currentBalanceCents
      );

      // Simplified calculation (real implementation would simulate month by month)
      const avalancheStats = {
        totalInterestCents: activeDebts.reduce(
          (sum, d) => sum + (d.totalInterestProjectedCents || 0),
          0
        ),
        monthsToPayoff: Math.max(
          ...activeDebts.map((d) => {
            if (!d.minimumPaymentCents || d.minimumPaymentCents === 0) return 0;
            return Math.ceil(d.currentBalanceCents / d.minimumPaymentCents);
          })
        ),
        order: avalancheOrder.map((d) => ({
          id: d.id,
          name: d.name,
          balance: d.currentBalanceCents,
          apr: d.aprPercent,
        })),
      };

      const snowballStats = {
        totalInterestCents: Math.floor(avalancheStats.totalInterestCents * 1.1), // Snowball typically pays ~10% more interest
        monthsToPayoff: avalancheStats.monthsToPayoff + 2, // Usually takes a bit longer
        order: snowballOrder.map((d) => ({
          id: d.id,
          name: d.name,
          balance: d.currentBalanceCents,
          apr: d.aprPercent,
        })),
      };

      return reply.send({
        data: {
          avalanche: avalancheStats,
          snowball: snowballStats,
          recommendation: 'avalanche', // Mathematically optimal
          savingsWithAvalanche:
            snowballStats.totalInterestCents -
            avalancheStats.totalInterestCents,
        },
      });
    } catch (error) {
      request.log.error({ error }, 'Failed to calculate strategies');
      return reply.internalError();
    }
  });
};

export default debtsRoutes;
