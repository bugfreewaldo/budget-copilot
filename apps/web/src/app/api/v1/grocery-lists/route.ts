import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { eq, desc } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { getDb } from '@/lib/db/client';
import { groceryLists, groceryItems } from '@/lib/db/schema';
import { getAuthenticatedUser } from '@/lib/api/auth';
import { json, errorJson, formatZodError } from '@/lib/api/utils';

export const dynamic = 'force-dynamic';

const createListSchema = z.object({
  name: z.string().min(1).max(200),
});

/**
 * GET /api/v1/grocery-lists - List all grocery lists
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(request);
    if (!auth.success) return auth.response;

    const db = getDb();

    const lists = await db
      .select()
      .from(groceryLists)
      .where(eq(groceryLists.userId, auth.user.id))
      .orderBy(desc(groceryLists.updatedAt));

    // Get item counts for each list
    const listsWithCounts = await Promise.all(
      lists.map(async (list) => {
        const items = await db
          .select()
          .from(groceryItems)
          .where(eq(groceryItems.listId, list.id));

        const totalItems = items.length;
        const checkedItems = items.filter((i) => i.checked).length;

        return { ...list, totalItems, checkedItems };
      })
    );

    return NextResponse.json({ data: listsWithCounts });
  } catch (error) {
    console.error('Failed to list grocery lists:', error);
    return errorJson('INTERNAL_ERROR', 'Failed to list grocery lists', 500);
  }
}

/**
 * POST /api/v1/grocery-lists - Create a new grocery list
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(request);
    if (!auth.success) return auth.response;

    const body = await request.json();
    const validation = createListSchema.safeParse(body);

    if (!validation.success) {
      return json(formatZodError(validation.error), 400);
    }

    const db = getDb();
    const id = nanoid();
    const now = Date.now();

    await db.insert(groceryLists).values({
      id,
      userId: auth.user.id,
      name: validation.data.name,
      createdAt: now,
      updatedAt: now,
    });

    const [created] = await db
      .select()
      .from(groceryLists)
      .where(eq(groceryLists.id, id));

    return NextResponse.json(
      { data: { ...created, totalItems: 0, checkedItems: 0 } },
      { status: 201 }
    );
  } catch (error) {
    console.error('Failed to create grocery list:', error);
    return errorJson('INTERNAL_ERROR', 'Failed to create grocery list', 500);
  }
}
