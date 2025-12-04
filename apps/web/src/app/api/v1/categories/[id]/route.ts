import { NextRequest } from 'next/server';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { categories } from '@/lib/db/schema';
import { idSchema, formatZodError, json, errorJson } from '@/lib/api/utils';

/**
 * Category update schema
 */
const updateCategorySchema = z
  .object({
    name: z.string().min(1).max(100),
    parentId: idSchema.nullable(),
    emoji: z.string().max(10).nullable(),
    color: z
      .string()
      .regex(/^#[0-9A-Fa-f]{6}$/)
      .nullable(),
  })
  .partial();

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/v1/categories/:id - Get category by ID
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const idValidation = idSchema.safeParse(id);
    if (!idValidation.success) {
      return errorJson('VALIDATION_ERROR', 'Invalid category ID', 400);
    }

    const db = getDb();
    const [category] = await db
      .select()
      .from(categories)
      .where(eq(categories.id, idValidation.data));

    if (!category) {
      return errorJson('NOT_FOUND', 'Category not found', 404);
    }

    return json({ data: category });
  } catch (error) {
    console.error('Failed to get category:', error);
    return errorJson('DB_ERROR', 'Failed to retrieve category', 500, {
      error: (error as Error).message,
    });
  }
}

/**
 * PATCH /api/v1/categories/:id - Update category
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const idValidation = idSchema.safeParse(id);
    if (!idValidation.success) {
      return errorJson('VALIDATION_ERROR', 'Invalid category ID', 400);
    }

    const body = await request.json();
    const validation = updateCategorySchema.safeParse(body);
    if (!validation.success) {
      return json(formatZodError(validation.error), 400);
    }

    const db = getDb();

    const [existing] = await db
      .select()
      .from(categories)
      .where(eq(categories.id, idValidation.data));

    if (!existing) {
      return errorJson('NOT_FOUND', 'Category not found', 404);
    }

    await db
      .update(categories)
      .set(validation.data)
      .where(eq(categories.id, idValidation.data));

    const [updated] = await db
      .select()
      .from(categories)
      .where(eq(categories.id, idValidation.data));

    return json({ data: updated });
  } catch (error) {
    console.error('Failed to update category:', error);
    return errorJson('DB_ERROR', 'Failed to update category', 500, {
      error: (error as Error).message,
    });
  }
}

/**
 * DELETE /api/v1/categories/:id - Delete category
 */
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const idValidation = idSchema.safeParse(id);
    if (!idValidation.success) {
      return errorJson('VALIDATION_ERROR', 'Invalid category ID', 400);
    }

    const db = getDb();

    const [existing] = await db
      .select()
      .from(categories)
      .where(eq(categories.id, idValidation.data));

    if (!existing) {
      return errorJson('NOT_FOUND', 'Category not found', 404);
    }

    await db.delete(categories).where(eq(categories.id, idValidation.data));

    return new Response(null, { status: 204 });
  } catch (error) {
    console.error('Failed to delete category:', error);
    return errorJson('DB_ERROR', 'Failed to delete category', 500, {
      error: (error as Error).message,
    });
  }
}
