import { NextRequest, NextResponse } from 'next/server';
import { eq, and } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { groceryItemPrices } from '@/lib/db/schema';
import { getAuthenticatedUser } from '@/lib/api/auth';
import { errorJson } from '@/lib/api/utils';

export const dynamic = 'force-dynamic';

/**
 * DELETE /api/v1/grocery-items/:itemId/prices/:priceId - Delete a price entry
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ itemId: string; priceId: string }> }
) {
  try {
    const auth = await getAuthenticatedUser(request);
    if (!auth.success) return auth.response;

    const { priceId } = await params;
    const db = getDb();

    const [existing] = await db
      .select()
      .from(groceryItemPrices)
      .where(
        and(
          eq(groceryItemPrices.id, priceId),
          eq(groceryItemPrices.userId, auth.user.id)
        )
      );

    if (!existing) {
      return errorJson('NOT_FOUND', 'Price not found', 404);
    }

    await db.delete(groceryItemPrices).where(eq(groceryItemPrices.id, priceId));

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('Failed to delete price:', error);
    return errorJson('INTERNAL_ERROR', 'Failed to delete price', 500);
  }
}
