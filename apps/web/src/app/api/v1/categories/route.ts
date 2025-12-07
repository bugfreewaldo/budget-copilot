import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { eq, desc } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { getDb } from '@/lib/db/client';
import { categories } from '@/lib/db/schema';
import { getAuthenticatedUser } from '@/lib/api/auth';
import { json, errorJson, formatZodError, idSchema } from '@/lib/api/utils';

export const dynamic = 'force-dynamic';

const createCategorySchema = z.object({
  name: z.string().min(1).max(100),
  parentId: idSchema.nullable().optional(),
  emoji: z.string().max(10).nullable().optional(),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .nullable()
    .optional(),
});

/**
 * GET /api/v1/categories - List all categories for the user
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(request);
    if (!auth.success) return auth.response;

    const db = getDb();
    const searchParams = request.nextUrl.searchParams;
    const flat = searchParams.get('flat') === 'true';

    if (flat) {
      // Return all categories flat
      const userCategories = await db
        .select()
        .from(categories)
        .where(eq(categories.userId, auth.user.id))
        .orderBy(desc(categories.createdAt));

      return NextResponse.json({ data: userCategories });
    }

    // Return only top-level categories (no parentId)
    const userCategories = await db
      .select()
      .from(categories)
      .where(eq(categories.userId, auth.user.id))
      .orderBy(desc(categories.createdAt));

    // Build hierarchical structure
    const categoryMap = new Map<string, typeof userCategories[0] & { children?: typeof userCategories }>();
    const topLevel: Array<typeof userCategories[0] & { children?: typeof userCategories }> = [];

    for (const cat of userCategories) {
      categoryMap.set(cat.id, { ...cat, children: [] });
    }

    for (const cat of userCategories) {
      const categoryWithChildren = categoryMap.get(cat.id)!;
      if (cat.parentId && categoryMap.has(cat.parentId)) {
        const parent = categoryMap.get(cat.parentId)!;
        parent.children = parent.children || [];
        parent.children.push(categoryWithChildren);
      } else if (!cat.parentId) {
        topLevel.push(categoryWithChildren);
      }
    }

    return NextResponse.json({ data: topLevel });
  } catch (error) {
    console.error('Failed to list categories:', error);
    return errorJson('INTERNAL_ERROR', 'Failed to list categories', 500);
  }
}

/**
 * POST /api/v1/categories - Create a new category
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(request);
    if (!auth.success) return auth.response;

    const body = await request.json();
    const validation = createCategorySchema.safeParse(body);

    if (!validation.success) {
      return json(formatZodError(validation.error), 400);
    }

    const data = validation.data;
    const db = getDb();

    const id = nanoid();
    const now = Date.now();

    await db.insert(categories).values({
      id,
      userId: auth.user.id,
      name: data.name,
      parentId: data.parentId || null,
      emoji: data.emoji || null,
      color: data.color || null,
      createdAt: now,
    });

    const [category] = await db
      .select()
      .from(categories)
      .where(eq(categories.id, id));

    return NextResponse.json({ data: category }, { status: 201 });
  } catch (error) {
    console.error('Failed to create category:', error);
    return errorJson('INTERNAL_ERROR', 'Failed to create category', 500);
  }
}
