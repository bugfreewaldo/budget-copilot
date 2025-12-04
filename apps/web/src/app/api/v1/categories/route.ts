import { NextRequest } from 'next/server';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { eq, isNull, and } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { categories } from '@/lib/db/schema';
import { idSchema, formatZodError, json, errorJson } from '@/lib/api/utils';

/**
 * Category validation schemas
 */
const createCategorySchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  parentId: idSchema.optional().nullable(),
  emoji: z.string().max(10).optional(),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Must be hex color')
    .optional(),
});

/**
 * GET /api/v1/categories - List all categories
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const parentId = searchParams.get('parentId');

    const db = getDb();
    // TODO: Get userId from session
    const userId = 'test-user-00000000000000000001';

    const conditions = [eq(categories.userId, userId)];

    if (parentId === 'null' || parentId === '') {
      conditions.push(isNull(categories.parentId));
    } else if (parentId) {
      conditions.push(eq(categories.parentId, parentId));
    }

    const result = await db
      .select()
      .from(categories)
      .where(and(...conditions));

    return json({ data: result });
  } catch (error) {
    console.error('Failed to list categories:', error);
    return errorJson('DB_ERROR', 'Failed to retrieve categories', 500, {
      error: (error as Error).message,
    });
  }
}

/**
 * POST /api/v1/categories - Create new category
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validation = createCategorySchema.safeParse(body);

    if (!validation.success) {
      return json(formatZodError(validation.error), 400);
    }

    const db = getDb();
    // TODO: Get userId from session
    const userId = 'test-user-00000000000000000001';
    const id = nanoid();
    const now = Date.now();

    await db.insert(categories).values({
      id,
      userId,
      name: validation.data.name,
      parentId: validation.data.parentId || null,
      emoji: validation.data.emoji || null,
      color: validation.data.color || null,
      createdAt: now,
    });

    const [category] = await db
      .select()
      .from(categories)
      .where(eq(categories.id, id));

    return json({ data: category }, 201);
  } catch (error) {
    console.error('Failed to create category:', error);
    return errorJson('DB_ERROR', 'Failed to create category', 500, {
      error: (error as Error).message,
    });
  }
}
