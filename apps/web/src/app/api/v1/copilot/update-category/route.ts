import { NextRequest } from 'next/server';
import { z } from 'zod';
import { json, errorJson, formatZodError, idSchema } from '@/lib/api/utils';
import { updateTransactionCategory } from '@/lib/copilot';

const updateCategorySchema = z.object({
  transactionId: idSchema,
  categoryId: idSchema,
});

/**
 * POST /api/v1/copilot/update-category - Update transaction category
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validation = updateCategorySchema.safeParse(body);

    if (!validation.success) {
      return json(formatZodError(validation.error), 400);
    }

    // TODO: Get userId from session
    const userId = 'test-user-00000000000000000001';

    const success = await updateTransactionCategory(
      validation.data.transactionId,
      validation.data.categoryId,
      userId
    );

    if (!success) {
      return errorJson('NOT_FOUND', 'Transaction not found', 404);
    }

    return json({ data: { success: true } });
  } catch (error) {
    console.error('Failed to update transaction category:', error);
    return errorJson('INTERNAL_ERROR', 'Failed to update category', 500, {
      error: (error as Error).message,
    });
  }
}
