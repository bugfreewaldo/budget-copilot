import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { eq, and, asc } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { getDb } from '@/lib/db/client';
import { groceryLists, groceryItems } from '@/lib/db/schema';
import { getAuthenticatedUser } from '@/lib/api/auth';
import { json, errorJson, formatZodError } from '@/lib/api/utils';

export const dynamic = 'force-dynamic';

const createItemSchema = z.object({
  name: z.string().min(1).max(300),
  quantity: z.string().max(50).optional().nullable(),
});

/**
 * GET /api/v1/grocery-lists/:id/items - List items in a grocery list
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthenticatedUser(request);
    if (!auth.success) return auth.response;

    const { id } = await params;
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

    const items = await db
      .select()
      .from(groceryItems)
      .where(eq(groceryItems.listId, id))
      .orderBy(
        asc(groceryItems.checked),
        asc(groceryItems.sortOrder),
        asc(groceryItems.createdAt)
      );

    return NextResponse.json({ data: items });
  } catch (error) {
    console.error('Failed to list grocery items:', error);
    return errorJson('INTERNAL_ERROR', 'Failed to list grocery items', 500);
  }
}

/**
 * POST /api/v1/grocery-lists/:id/items - Add item to grocery list
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthenticatedUser(request);
    if (!auth.success) return auth.response;

    const { id } = await params;
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

    const body = await request.json();
    const validation = createItemSchema.safeParse(body);

    if (!validation.success) {
      return json(formatZodError(validation.error), 400);
    }

    const itemId = nanoid();
    const now = Date.now();

    await db.insert(groceryItems).values({
      id: itemId,
      listId: id,
      userId: auth.user.id,
      name: validation.data.name,
      quantity: validation.data.quantity || null,
      checked: false,
      sortOrder: now,
      createdAt: now,
    });

    // Update list's updatedAt
    await db
      .update(groceryLists)
      .set({ updatedAt: now })
      .where(eq(groceryLists.id, id));

    const [created] = await db
      .select()
      .from(groceryItems)
      .where(eq(groceryItems.id, itemId));

    return NextResponse.json({ data: created }, { status: 201 });
  } catch (error) {
    console.error('Failed to create grocery item:', error);
    return errorJson('INTERNAL_ERROR', 'Failed to create grocery item', 500);
  }
}
