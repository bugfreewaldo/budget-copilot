import { NextRequest, NextResponse } from 'next/server';
import { eq, and } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { groceryStores, groceryItemPrices } from '@/lib/db/schema';
import { getAuthenticatedUser } from '@/lib/api/auth';
import { errorJson } from '@/lib/api/utils';

export const dynamic = 'force-dynamic';

/**
 * DELETE /api/v1/grocery-stores/:id - Delete a store and its prices
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthenticatedUser(request);
    if (!auth.success) return auth.response;

    const { id } = await params;
    const db = getDb();

    const [existing] = await db
      .select()
      .from(groceryStores)
      .where(
        and(eq(groceryStores.id, id), eq(groceryStores.userId, auth.user.id))
      );

    if (!existing) {
      return errorJson('NOT_FOUND', 'Store not found', 404);
    }

    await db.delete(groceryItemPrices).where(eq(groceryItemPrices.storeId, id));
    await db.delete(groceryStores).where(eq(groceryStores.id, id));

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('Failed to delete grocery store:', error);
    return errorJson('INTERNAL_ERROR', 'Failed to delete grocery store', 500);
  }
}
