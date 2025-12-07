import { NextRequest } from 'next/server';
import { eq, and } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { scheduledIncome } from '@/lib/db/schema';
import { getAuthenticatedUser } from '@/lib/api/auth';
import { idSchema, errorJson } from '@/lib/api/utils';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * DELETE /api/v1/scheduled-income/:id - Delete a scheduled income
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await getAuthenticatedUser(request);
    if (!auth.success) return auth.response;

    const { id } = await params;
    const validation = idSchema.safeParse(id);

    if (!validation.success) {
      return errorJson('VALIDATION_ERROR', 'Invalid income ID format', 400);
    }

    const db = getDb();

    // Check if income exists and belongs to user
    const [existing] = await db
      .select()
      .from(scheduledIncome)
      .where(
        and(
          eq(scheduledIncome.id, id),
          eq(scheduledIncome.userId, auth.user.id)
        )
      );

    if (!existing) {
      return errorJson('NOT_FOUND', 'Scheduled income not found', 404);
    }

    // Delete the income
    await db
      .delete(scheduledIncome)
      .where(
        and(
          eq(scheduledIncome.id, id),
          eq(scheduledIncome.userId, auth.user.id)
        )
      );

    return new Response(null, { status: 204 });
  } catch (error) {
    console.error('Failed to delete scheduled income:', error);
    return errorJson('DB_ERROR', 'Failed to delete scheduled income', 500);
  }
}
