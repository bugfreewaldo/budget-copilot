import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { groceryLists, groceryItems } from '@/lib/db/schema';
import { getAuthenticatedUser } from '@/lib/api/auth';
import { json, errorJson, formatZodError } from '@/lib/api/utils';

export const dynamic = 'force-dynamic';

const updateItemSchema = z.object({
  name: z.string().min(1).max(300).optional(),
  quantity: z.string().max(50).optional().nullable(),
  checked: z.boolean().optional(),
  sortOrder: z.number().optional(),
});

/**
 * PATCH /api/v1/grocery-lists/:id/items/:itemId - Update a grocery item
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const auth = await getAuthenticatedUser(request);
    if (!auth.success) return auth.response;

    const { id, itemId } = await params;
    const db = getDb();

    // Verify list ownership
    const [list] = await db
      .select()
      .from(groceryLists)
      .where(
        and(eq(groceryLists.id, id), eq(groceryLists.userId, auth.user.id))
      );

    if (!list) {
      return errorJson('NOT_FOUND', 'Grocery list not found', 404);
    }

    const [existing] = await db
      .select()
      .from(groceryItems)
      .where(and(eq(groceryItems.id, itemId), eq(groceryItems.listId, id)));

    if (!existing) {
      return errorJson('NOT_FOUND', 'Grocery item not found', 404);
    }

    const body = await request.json();
    const validation = updateItemSchema.safeParse(body);

    if (!validation.success) {
      return json(formatZodError(validation.error), 400);
    }

    await db
      .update(groceryItems)
      .set(validation.data)
      .where(eq(groceryItems.id, itemId));

    // Update list's updatedAt
    await db
      .update(groceryLists)
      .set({ updatedAt: Date.now() })
      .where(eq(groceryLists.id, id));

    const [updated] = await db
      .select()
      .from(groceryItems)
      .where(eq(groceryItems.id, itemId));

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error('Failed to update grocery item:', error);
    return errorJson('INTERNAL_ERROR', 'Failed to update grocery item', 500);
  }
}

/**
 * DELETE /api/v1/grocery-lists/:id/items/:itemId - Delete a grocery item
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const auth = await getAuthenticatedUser(request);
    if (!auth.success) return auth.response;

    const { id, itemId } = await params;
    const db = getDb();

    // Verify list ownership
    const [list] = await db
      .select()
      .from(groceryLists)
      .where(
        and(eq(groceryLists.id, id), eq(groceryLists.userId, auth.user.id))
      );

    if (!list) {
      return errorJson('NOT_FOUND', 'Grocery list not found', 404);
    }

    const [existing] = await db
      .select()
      .from(groceryItems)
      .where(and(eq(groceryItems.id, itemId), eq(groceryItems.listId, id)));

    if (!existing) {
      return errorJson('NOT_FOUND', 'Grocery item not found', 404);
    }

    await db.delete(groceryItems).where(eq(groceryItems.id, itemId));

    // Update list's updatedAt
    await db
      .update(groceryLists)
      .set({ updatedAt: Date.now() })
      .where(eq(groceryLists.id, id));

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('Failed to delete grocery item:', error);
    return errorJson('INTERNAL_ERROR', 'Failed to delete grocery item', 500);
  }
}
