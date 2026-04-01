import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { groceryLists, groceryItems } from '@/lib/db/schema';
import { getAuthenticatedUser } from '@/lib/api/auth';
import { json, errorJson, formatZodError } from '@/lib/api/utils';

export const dynamic = 'force-dynamic';

const updateListSchema = z.object({
  name: z.string().min(1).max(200).optional(),
});

/**
 * PATCH /api/v1/grocery-lists/:id - Update a grocery list
 */
export async function PATCH(
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
      .from(groceryLists)
      .where(
        and(eq(groceryLists.id, id), eq(groceryLists.userId, auth.user.id))
      );

    if (!existing) {
      return errorJson('NOT_FOUND', 'Grocery list not found', 404);
    }

    const body = await request.json();
    const validation = updateListSchema.safeParse(body);

    if (!validation.success) {
      return json(formatZodError(validation.error), 400);
    }

    await db
      .update(groceryLists)
      .set({ ...validation.data, updatedAt: Date.now() })
      .where(eq(groceryLists.id, id));

    const [updated] = await db
      .select()
      .from(groceryLists)
      .where(eq(groceryLists.id, id));

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error('Failed to update grocery list:', error);
    return errorJson('INTERNAL_ERROR', 'Failed to update grocery list', 500);
  }
}

/**
 * DELETE /api/v1/grocery-lists/:id - Delete a grocery list and its items
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
      .from(groceryLists)
      .where(
        and(eq(groceryLists.id, id), eq(groceryLists.userId, auth.user.id))
      );

    if (!existing) {
      return errorJson('NOT_FOUND', 'Grocery list not found', 404);
    }

    // Delete items first, then the list
    await db.delete(groceryItems).where(eq(groceryItems.listId, id));
    await db.delete(groceryLists).where(eq(groceryLists.id, id));

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('Failed to delete grocery list:', error);
    return errorJson('INTERNAL_ERROR', 'Failed to delete grocery list', 500);
  }
}
