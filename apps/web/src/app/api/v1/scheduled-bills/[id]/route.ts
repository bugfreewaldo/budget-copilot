import { NextRequest } from 'next/server';
import { eq, and } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { scheduledBills } from '@/lib/db/schema';
import { getAuthenticatedUser } from '@/lib/api/auth';
import { idSchema, errorJson } from '@/lib/api/utils';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * DELETE /api/v1/scheduled-bills/:id - Delete a scheduled bill
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await getAuthenticatedUser(request);
    if (!auth.success) return auth.response;

    const { id } = await params;
    const validation = idSchema.safeParse(id);

    if (!validation.success) {
      return errorJson('VALIDATION_ERROR', 'Invalid bill ID format', 400);
    }

    const db = getDb();

    // Check if bill exists and belongs to user
    const [existing] = await db
      .select()
      .from(scheduledBills)
      .where(
        and(eq(scheduledBills.id, id), eq(scheduledBills.userId, auth.user.id))
      );

    if (!existing) {
      return errorJson('NOT_FOUND', 'Scheduled bill not found', 404);
    }

    // Delete the bill
    await db
      .delete(scheduledBills)
      .where(
        and(eq(scheduledBills.id, id), eq(scheduledBills.userId, auth.user.id))
      );

    return new Response(null, { status: 204 });
  } catch (error) {
    console.error('Failed to delete scheduled bill:', error);
    return errorJson('DB_ERROR', 'Failed to delete scheduled bill', 500);
  }
}
