import { NextRequest } from 'next/server';
import { eq, and } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { envelopes } from '@/lib/db/schema';
import { getAuthenticatedUser } from '@/lib/api/auth';
import { idSchema, errorJson } from '@/lib/api/utils';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * DELETE /api/v1/envelopes/:id - Delete an envelope
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await getAuthenticatedUser(request);
    if (!auth.success) return auth.response;

    const { id } = await params;
    const idValidation = idSchema.safeParse(id);
    if (!idValidation.success) {
      return errorJson('VALIDATION_ERROR', 'Invalid envelope ID', 400);
    }

    const db = getDb();

    const [existing] = await db
      .select()
      .from(envelopes)
      .where(
        and(
          eq(envelopes.id, idValidation.data),
          eq(envelopes.userId, auth.user.id)
        )
      );

    if (!existing) {
      return errorJson('NOT_FOUND', 'Envelope not found', 404);
    }

    await db
      .delete(envelopes)
      .where(
        and(
          eq(envelopes.id, idValidation.data),
          eq(envelopes.userId, auth.user.id)
        )
      );

    return new Response(null, { status: 204 });
  } catch (error) {
    console.error('Failed to delete envelope:', error);
    return errorJson('DB_ERROR', 'Failed to delete envelope', 500);
  }
}
