import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { eq, asc } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { getDb } from '@/lib/db/client';
import { groceryStores } from '@/lib/db/schema';
import { getAuthenticatedUser } from '@/lib/api/auth';
import { json, errorJson, formatZodError } from '@/lib/api/utils';

export const dynamic = 'force-dynamic';

const createStoreSchema = z.object({
  name: z.string().min(1).max(200),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
});

/**
 * GET /api/v1/grocery-stores - List all stores
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(request);
    if (!auth.success) return auth.response;

    const db = getDb();

    const stores = await db
      .select()
      .from(groceryStores)
      .where(eq(groceryStores.userId, auth.user.id))
      .orderBy(asc(groceryStores.name));

    return NextResponse.json({ data: stores });
  } catch (error) {
    console.error('Failed to list grocery stores:', error);
    return errorJson('INTERNAL_ERROR', 'Failed to list grocery stores', 500);
  }
}

/**
 * POST /api/v1/grocery-stores - Create a new store
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(request);
    if (!auth.success) return auth.response;

    const body = await request.json();
    const validation = createStoreSchema.safeParse(body);

    if (!validation.success) {
      return json(formatZodError(validation.error), 400);
    }

    const db = getDb();
    const id = nanoid();

    await db.insert(groceryStores).values({
      id,
      userId: auth.user.id,
      name: validation.data.name,
      color: validation.data.color || '#06b6d4',
      createdAt: Date.now(),
    });

    const [created] = await db
      .select()
      .from(groceryStores)
      .where(eq(groceryStores.id, id));

    return NextResponse.json({ data: created }, { status: 201 });
  } catch (error) {
    console.error('Failed to create grocery store:', error);
    return errorJson('INTERNAL_ERROR', 'Failed to create grocery store', 500);
  }
}
