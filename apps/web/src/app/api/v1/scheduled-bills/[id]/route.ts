import { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { scheduledBills } from '@/lib/db/schema';
import { idSchema, json, errorJson } from '@/lib/api/utils';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * DELETE /api/v1/scheduled-bills/:id - Delete a scheduled bill
 */
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const validation = idSchema.safeParse(id);

    if (!validation.success) {
      return json({ error: 'Invalid bill ID format' }, 400);
    }

    const db = getDb();
    // TODO: Get userId from session
    const userId = 'demo-user';

    // Check if bill exists and belongs to user
    const [existing] = await db
      .select()
      .from(scheduledBills)
      .where(eq(scheduledBills.id, id));

    if (!existing || existing.userId !== userId) {
      return errorJson('NOT_FOUND', 'Scheduled bill not found', 404);
    }

    // Delete the bill
    await db.delete(scheduledBills).where(eq(scheduledBills.id, id));

    return json({ success: true, deleted: id });
  } catch (error) {
    console.error('Failed to delete scheduled bill:', error);
    return errorJson('DB_ERROR', 'Failed to delete scheduled bill', 500, {
      error: (error as Error).message,
    });
  }
}
