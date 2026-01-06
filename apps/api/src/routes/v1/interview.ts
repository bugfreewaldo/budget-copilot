import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { eq } from 'drizzle-orm';
import { requireAuth } from '../../server/plugins/auth.js';
import { getDb } from '../../db/client.js';
import { interviewSessions, userProfiles } from '../../db/schema.js';
import * as interviewEngine from '../../services/interview-engine/index.js';

/**
 * Interview V1 Routes
 * AI-powered financial interview for onboarding
 */

// ============================================================================
// Validation Schemas
// ============================================================================

const messageSchema = z.object({
  message: z.string().min(1, 'Message is required').max(2000),
});

// ============================================================================
// Route Handlers
// ============================================================================

const interviewRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /v1/interview
   * Get current interview state or create new session
   */
  fastify.get(
    '/interview',
    { preHandler: requireAuth },
    async (request, reply) => {
      try {
        const userId = request.user!.id;
        const db = await getDb();

        // Check for existing session
        const existingSession = await db
          .select()
          .from(interviewSessions)
          .where(eq(interviewSessions.userId, userId))
          .get();

        if (existingSession) {
          // Return existing session
          const conversationHistory = existingSession.conversationHistory
            ? JSON.parse(existingSession.conversationHistory)
            : [];
          const extractedData = existingSession.extractedData
            ? JSON.parse(existingSession.extractedData)
            : interviewEngine.initializeInterview().extractedData;
          const insightFlags = existingSession.insightFlags
            ? JSON.parse(existingSession.insightFlags)
            : [];

          return reply.send({
            data: {
              id: existingSession.id,
              status: existingSession.status,
              currentStep: existingSession.currentStep,
              conversationHistory,
              extractedData,
              insightFlags,
              isComplete: existingSession.status === 'completed',
              initialMessage:
                conversationHistory.length === 0
                  ? interviewEngine.getInitialMessage()
                  : null,
            },
          });
        }

        // Create new session
        const newSession = {
          id: nanoid(),
          userId,
          status: 'in_progress' as const,
          currentStep: 'cash' as const,
          conversationHistory: JSON.stringify([]),
          extractedData: JSON.stringify(
            interviewEngine.initializeInterview().extractedData
          ),
          insightFlags: JSON.stringify([]),
          uploadedFileIds: JSON.stringify([]),
          startedAt: Date.now(),
          lastActivityAt: Date.now(),
        };

        await db.insert(interviewSessions).values(newSession);

        return reply.send({
          data: {
            id: newSession.id,
            status: newSession.status,
            currentStep: newSession.currentStep,
            conversationHistory: [],
            extractedData: interviewEngine.initializeInterview().extractedData,
            insightFlags: [],
            isComplete: false,
            initialMessage: interviewEngine.getInitialMessage(),
          },
        });
      } catch (error) {
        request.log.error({ error }, 'Failed to get interview state');
        return reply.internalError();
      }
    }
  );

  /**
   * POST /v1/interview/message
   * Send a message to the interview agent
   */
  fastify.post(
    '/interview/message',
    { preHandler: requireAuth },
    async (request, reply) => {
      try {
        const validation = fastify.safeValidate(messageSchema, request.body);

        if (!validation.success) {
          return reply.badRequest('Invalid request body', validation.errors);
        }

        const { message } = validation.data;
        const userId = request.user!.id;
        const db = await getDb();

        // Get existing session
        const session = await db
          .select()
          .from(interviewSessions)
          .where(eq(interviewSessions.userId, userId))
          .get();

        if (!session) {
          return reply.notFound(
            'No interview session found. Start a new interview first.'
          );
        }

        if (session.status === 'completed') {
          return reply.badRequest('Interview already completed.');
        }

        // Parse stored state
        const conversationHistory = session.conversationHistory
          ? JSON.parse(session.conversationHistory)
          : [];
        const extractedData = session.extractedData
          ? JSON.parse(session.extractedData)
          : interviewEngine.initializeInterview().extractedData;
        const insightFlags = session.insightFlags
          ? JSON.parse(session.insightFlags)
          : [];

        // Build current state
        const currentState: interviewEngine.InterviewState = {
          currentStep: session.currentStep as interviewEngine.InterviewStep,
          extractedData,
          conversationHistory,
          insightFlags,
          isComplete: false,
        };

        // Process message through interview engine
        const result = await interviewEngine.processInterviewMessage(
          message,
          currentState
        );

        // Calculate insight flags
        const calculatedFlags = interviewEngine.calculateInsightFlags(
          result.newState.extractedData
        );
        const mergedFlags = Array.from(
          new Set([...result.newState.insightFlags, ...calculatedFlags])
        );

        // Update session in database
        await db
          .update(interviewSessions)
          .set({
            currentStep: result.newState.currentStep,
            conversationHistory: JSON.stringify(
              result.newState.conversationHistory
            ),
            extractedData: JSON.stringify(result.newState.extractedData),
            insightFlags: JSON.stringify(mergedFlags),
            status: result.newState.isComplete ? 'completed' : 'in_progress',
            completedAt: result.newState.isComplete ? Date.now() : undefined,
            lastActivityAt: Date.now(),
          })
          .where(eq(interviewSessions.id, session.id));

        // If complete, update user profile onboarding status
        if (result.newState.isComplete) {
          await updateUserProfileFromInterview(
            userId,
            result.newState.extractedData
          );
        }

        return reply.send({
          data: {
            message: result.response,
            currentStep: result.newState.currentStep,
            isComplete: result.newState.isComplete,
            insightFlags: mergedFlags,
            // Include summary if complete
            summary: result.newState.isComplete
              ? interviewEngine.generateSummaryMessage(
                  result.newState.extractedData
                )
              : null,
          },
        });
      } catch (error) {
        request.log.error({ error }, 'Failed to process interview message');
        return reply.internalError();
      }
    }
  );

  /**
   * POST /v1/interview/skip
   * Skip the interview and proceed without completing
   */
  fastify.post(
    '/interview/skip',
    { preHandler: requireAuth },
    async (request, reply) => {
      try {
        const userId = request.user!.id;
        const db = await getDb();

        // Get existing session
        const session = await db
          .select()
          .from(interviewSessions)
          .where(eq(interviewSessions.userId, userId))
          .get();

        if (session) {
          // Mark as abandoned
          await db
            .update(interviewSessions)
            .set({
              status: 'abandoned',
              lastActivityAt: Date.now(),
            })
            .where(eq(interviewSessions.id, session.id));
        }

        // Mark onboarding as complete (skipped)
        await db
          .update(userProfiles)
          .set({
            onboardingCompleted: true,
            onboardingStep: 0, // Skipped
            updatedAt: Date.now(),
          })
          .where(eq(userProfiles.userId, userId));

        return reply.send({
          data: {
            success: true,
            message:
              'Interview skipped. You can provide this information later.',
          },
        });
      } catch (error) {
        request.log.error({ error }, 'Failed to skip interview');
        return reply.internalError();
      }
    }
  );

  /**
   * POST /v1/interview/complete
   * Manually complete the interview with current data
   */
  fastify.post(
    '/interview/complete',
    { preHandler: requireAuth },
    async (request, reply) => {
      try {
        const userId = request.user!.id;
        const db = await getDb();

        const session = await db
          .select()
          .from(interviewSessions)
          .where(eq(interviewSessions.userId, userId))
          .get();

        if (!session) {
          return reply.notFound('No interview session found.');
        }

        const extractedData = session.extractedData
          ? JSON.parse(session.extractedData)
          : interviewEngine.initializeInterview().extractedData;

        // Calculate final insight flags
        const insightFlags =
          interviewEngine.calculateInsightFlags(extractedData);

        // Mark as completed
        await db
          .update(interviewSessions)
          .set({
            status: 'completed',
            insightFlags: JSON.stringify(insightFlags),
            completedAt: Date.now(),
            lastActivityAt: Date.now(),
          })
          .where(eq(interviewSessions.id, session.id));

        // Update user profile
        await updateUserProfileFromInterview(userId, extractedData);

        return reply.send({
          data: {
            success: true,
            summary: interviewEngine.generateSummaryMessage(extractedData),
            insightFlags,
          },
        });
      } catch (error) {
        request.log.error({ error }, 'Failed to complete interview');
        return reply.internalError();
      }
    }
  );

  /**
   * DELETE /v1/interview
   * Reset the interview session (start over)
   */
  fastify.delete(
    '/interview',
    { preHandler: requireAuth },
    async (request, reply) => {
      try {
        const userId = request.user!.id;
        const db = await getDb();

        await db
          .delete(interviewSessions)
          .where(eq(interviewSessions.userId, userId));

        return reply.send({
          data: {
            success: true,
            message: 'Interview reset. Start a new interview to begin again.',
          },
        });
      } catch (error) {
        request.log.error({ error }, 'Failed to reset interview');
        return reply.internalError();
      }
    }
  );
};

// ============================================================================
// Helper Functions
// ============================================================================

async function updateUserProfileFromInterview(
  userId: string,
  extractedData: interviewEngine.ExtractedData
): Promise<void> {
  const db = await getDb();

  // Check if profile exists
  const existingProfile = await db
    .select()
    .from(userProfiles)
    .where(eq(userProfiles.userId, userId))
    .get();

  const profileData = {
    onboardingCompleted: true,
    onboardingStep: 8, // All steps completed
    monthlySalaryCents: extractedData.income_monthly?.value
      ? Math.round(extractedData.income_monthly.value * 100)
      : undefined,
    monthlySavingsGoalCents: extractedData.savings_monthly?.value
      ? Math.round(extractedData.savings_monthly.value * 100)
      : undefined,
    updatedAt: Date.now(),
  };

  if (existingProfile) {
    await db
      .update(userProfiles)
      .set(profileData)
      .where(eq(userProfiles.userId, userId));
  } else {
    await db.insert(userProfiles).values({
      id: nanoid(),
      userId,
      ...profileData,
      createdAt: Date.now(),
    });
  }
}

export default interviewRoutes;
