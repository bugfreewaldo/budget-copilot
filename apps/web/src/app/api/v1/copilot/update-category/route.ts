import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthenticatedUser } from '@/lib/api/auth';
import { json, formatZodError, errorJson, idSchema } from '@/lib/api/utils';
import { updateTransactionCategory } from '@/lib/copilot';

export const dynamic = 'force-dynamic';

const updateCategorySchema = z.object({
  transactionId: idSchema,
  categoryId: idSchema,
});

/**
 * POST /api/v1/copilot/update-category - Update transaction category
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(request);
    if (!auth.success) return auth.response;

    const body = await request.json();
    const validation = updateCategorySchema.safeParse(body);

    if (!validation.success) {
      return json(formatZodError(validation.error), 400);
    }

    const success = await updateTransactionCategory(
      validation.data.transactionId,
      validation.data.categoryId,
      auth.user.id
    );

    if (!success) {
      return errorJson('NOT_FOUND', 'Transaction not found', 404);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to update transaction category:', error);
    return errorJson('INTERNAL_ERROR', 'Failed to update category', 500);
  }
}
