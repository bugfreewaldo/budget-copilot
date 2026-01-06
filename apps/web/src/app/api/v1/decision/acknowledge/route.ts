import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { decisionState } from '@/lib/db/schema';
import { getAuthenticatedUser } from '@/lib/api/auth';
import { errorJson, formatZodError, json } from '@/lib/api/utils';

export const dynamic = 'force-dynamic';

const acknowledgeSchema = z.object({
  decisionId: z.string().min(1),
});

/**
 * POST /api/v1/decision/acknowledge - Mark decision as acknowledged
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(request);
    if (!auth.success) return auth.response;

    const body = await request.json();
    const validation = acknowledgeSchema.safeParse(body);

    if (!validation.success) {
      return json(formatZodError(validation.error), 400);
    }

    const { decisionId } = validation.data;
    const db = getDb();

    await db
      .update(decisionState)
      .set({ acknowledgedAt: Date.now() })
      .where(eq(decisionState.id, decisionId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to acknowledge decision:', error);
    return errorJson('INTERNAL_ERROR', 'Failed to acknowledge decision', 500);
  }
}
