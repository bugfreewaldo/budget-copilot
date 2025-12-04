import { NextRequest } from 'next/server';
import { z } from 'zod';
import { json, errorJson, formatZodError } from '@/lib/api/utils';
import { processMessage } from '@/lib/copilot';

const chatRequestSchema = z.object({
  message: z.string().min(1, 'Message is required'),
});

/**
 * POST /api/v1/copilot/chat - Process a chat message
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validation = chatRequestSchema.safeParse(body);

    if (!validation.success) {
      return json(formatZodError(validation.error), 400);
    }

    // TODO: Get userId from session
    const userId = 'test-user-00000000000000000001';

    const response = await processMessage(userId, validation.data.message);

    return json({ data: response });
  } catch (error) {
    console.error('Failed to process chat message:', error);
    return errorJson('INTERNAL_ERROR', 'Failed to process message', 500, {
      error: (error as Error).message,
    });
  }
}
