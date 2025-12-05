import { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { scheduledIncome } from '@/lib/db/schema';
import { idSchema, json, errorJson } from '@/lib/api/utils';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * DELETE /api/v1/scheduled-income/:id - Delete a scheduled income
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const validation = idSchema.safeParse(id);

    if (!validation.success) {
      return json({ error: 'Invalid income ID format' }, 400);
    }

    const db = getDb();
    // TODO: Get userId from session
    const userId = 'demo-user';

    // Check if income exists and belongs to user
    const [existing] = await db
      .select()
      .from(scheduledIncome)
      .where(eq(scheduledIncome.id, id));

    if (!existing || existing.userId !== userId) {
      return errorJson('NOT_FOUND', 'Scheduled income not found', 404);
    }

    // Delete the income
    await db.delete(scheduledIncome).where(eq(scheduledIncome.id, id));

    return json({ success: true, deleted: id });
  } catch (error) {
    console.error('Failed to delete scheduled income:', error);
    return errorJson('DB_ERROR', 'Failed to delete scheduled income', 500, {
      error: (error as Error).message,
    });
  }
}
