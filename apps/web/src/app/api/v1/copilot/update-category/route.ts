import { NextRequest } from 'next/server';
import { proxyToApi } from '@/lib/api/proxy';
import { z } from 'zod';
import { json, formatZodError, idSchema } from '@/lib/api/utils';

const updateCategorySchema = z.object({
  transactionId: idSchema,
  categoryId: idSchema,
});

/**
 * POST /api/v1/copilot/update-category - Update transaction category
 * Proxies to Fastify backend PATCH /v1/transactions/:id
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validation = updateCategorySchema.safeParse(body);

    if (!validation.success) {
      return json(formatZodError(validation.error), 400);
    }

    // Proxy to Fastify's PATCH /v1/transactions/:id endpoint
    return proxyToApi(
      request,
      `/v1/transactions/${validation.data.transactionId}`,
      {
        method: 'PATCH',
        body: JSON.stringify({ category_id: validation.data.categoryId }),
      }
    );
  } catch (error) {
    console.error('Failed to update transaction category:', error);
    return json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to update category',
        },
      },
      500
    );
  }
}
