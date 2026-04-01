import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { getDb } from '@/lib/db/client';
import { groceryItems, groceryItemPrices } from '@/lib/db/schema';
import { getAuthenticatedUser } from '@/lib/api/auth';
import {
  json,
  errorJson,
  formatZodError,
  centsSchema,
  idSchema,
} from '@/lib/api/utils';

export const dynamic = 'force-dynamic';

const createPriceSchema = z.object({
  storeId: idSchema,
  priceCents: centsSchema,
});

/**
 * GET /api/v1/grocery-items/:itemId/prices - List prices for an item
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
) {
  try {
    const auth = await getAuthenticatedUser(request);
    if (!auth.success) return auth.response;

    const { itemId } = await params;
    const db = getDb();

    // Verify item ownership
    const [item] = await db
      .select()
      .from(groceryItems)
      .where(
        and(eq(groceryItems.id, itemId), eq(groceryItems.userId, auth.user.id))
      );

    if (!item) {
      return errorJson('NOT_FOUND', 'Item not found', 404);
    }

    const prices = await db
      .select()
      .from(groceryItemPrices)
      .where(eq(groceryItemPrices.itemId, itemId));

    return NextResponse.json({ data: prices });
  } catch (error) {
    console.error('Failed to list item prices:', error);
    return errorJson('INTERNAL_ERROR', 'Failed to list item prices', 500);
  }
}

/**
 * POST /api/v1/grocery-items/:itemId/prices - Add or update a price for an item at a store
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
) {
  try {
    const auth = await getAuthenticatedUser(request);
    if (!auth.success) return auth.response;

    const { itemId } = await params;
    const db = getDb();

    // Verify item ownership
    const [item] = await db
      .select()
      .from(groceryItems)
      .where(
        and(eq(groceryItems.id, itemId), eq(groceryItems.userId, auth.user.id))
      );

    if (!item) {
      return errorJson('NOT_FOUND', 'Item not found', 404);
    }

    const body = await request.json();
    const validation = createPriceSchema.safeParse(body);

    if (!validation.success) {
      return json(formatZodError(validation.error), 400);
    }

    const { storeId, priceCents } = validation.data;
    const now = Date.now();

    // Upsert: check if price already exists for this item+store
    const [existing] = await db
      .select()
      .from(groceryItemPrices)
      .where(
        and(
          eq(groceryItemPrices.itemId, itemId),
          eq(groceryItemPrices.storeId, storeId)
        )
      );

    if (existing) {
      await db
        .update(groceryItemPrices)
        .set({ priceCents, updatedAt: now })
        .where(eq(groceryItemPrices.id, existing.id));

      const [updated] = await db
        .select()
        .from(groceryItemPrices)
        .where(eq(groceryItemPrices.id, existing.id));

      return NextResponse.json({ data: updated });
    }

    const id = nanoid();
    await db.insert(groceryItemPrices).values({
      id,
      itemId,
      storeId,
      userId: auth.user.id,
      priceCents,
      createdAt: now,
      updatedAt: now,
    });

    const [created] = await db
      .select()
      .from(groceryItemPrices)
      .where(eq(groceryItemPrices.id, id));

    return NextResponse.json({ data: created }, { status: 201 });
  } catch (error) {
    console.error('Failed to create item price:', error);
    return errorJson('INTERNAL_ERROR', 'Failed to create item price', 500);
  }
}
