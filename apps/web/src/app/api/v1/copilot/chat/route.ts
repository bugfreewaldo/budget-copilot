import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthenticatedUser } from '@/lib/api/auth';
import { json, formatZodError, errorJson } from '@/lib/api/utils';
import { processMessage } from '@/lib/copilot';

export const dynamic = 'force-dynamic';

const chatSchema = z.object({
  message: z.string().min(1, 'Message is required'),
});

/**
 * POST /api/v1/copilot/chat - Process a chat message
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(request);
    if (!auth.success) return auth.response;

    const body = await request.json();
    const validation = chatSchema.safeParse(body);

    if (!validation.success) {
      return json(formatZodError(validation.error), 400);
    }

    const response = await processMessage(
      auth.user.id,
      validation.data.message
    );

    return NextResponse.json({ data: response });
  } catch (error) {
    console.error('Failed to process chat message:', error);
    return errorJson('INTERNAL_ERROR', 'Failed to process message', 500);
  }
}
