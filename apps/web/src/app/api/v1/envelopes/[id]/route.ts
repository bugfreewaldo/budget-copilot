import { NextRequest } from 'next/server';
import { eq, and } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { envelopes } from '@/lib/db/schema';
import { idSchema, json, errorJson } from '@/lib/api/utils';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * DELETE /api/v1/envelopes/:id - Delete an envelope
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const validation = idSchema.safeParse(id);

    if (!validation.success) {
      return json({ error: 'Invalid envelope ID format' }, 400);
    }

    const db = getDb();
    // TODO: Get userId from session
    const userId = 'test-user-00000000000000000001';

    // Check if envelope exists and belongs to user
    const [existing] = await db
      .select()
      .from(envelopes)
      .where(and(eq(envelopes.id, id), eq(envelopes.userId, userId)));

    if (!existing) {
      return errorJson('NOT_FOUND', 'Envelope not found', 404);
    }

    // Delete the envelope
    await db
      .delete(envelopes)
      .where(and(eq(envelopes.id, id), eq(envelopes.userId, userId)));

    return json({ success: true, deleted: id });
  } catch (error) {
    console.error('Failed to delete envelope:', error);
    return errorJson('DB_ERROR', 'Failed to delete envelope', 500, {
      error: (error as Error).message,
    });
  }
}
