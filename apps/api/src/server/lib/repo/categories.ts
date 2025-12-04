import { eq, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import type { DatabaseInstance } from '../../../db/client.js';
import { categories } from '../../../db/schema.js';
import type { CreateCategoryInput } from '../../schemas/categories.js';

/**
 * Category repository
 * Data access layer for categories table
 */

export async function findAllCategories(
  db: DatabaseInstance,
  options?: { parentId?: string; userId?: string }
) {
  const conditions = [];

  if (options?.userId) {
    conditions.push(eq(categories.userId, options.userId));
  }
  if (options?.parentId !== undefined) {
    conditions.push(eq(categories.parentId, options.parentId));
  }

  if (conditions.length > 0) {
    return await db
      .select()
      .from(categories)
      .where(conditions.length === 1 ? conditions[0] : and(...conditions));
  }
  return await db.select().from(categories);
}

export async function findCategoryById(db: DatabaseInstance, id: string) {
  const result = await db
    .select()
    .from(categories)
    .where(eq(categories.id, id));
  return result[0];
}

export async function createCategory(
  db: DatabaseInstance,
  input: CreateCategoryInput & { userId: string }
) {
  const id = nanoid();
  const now = Date.now();

  await db.insert(categories).values({
    id,
    userId: input.userId,
    name: input.name,
    parentId: input.parentId || null,
    emoji: input.emoji || null,
    color: input.color || null,
    createdAt: now,
  });

  return await findCategoryById(db, id);
}

export async function findCategoryByName(
  db: DatabaseInstance,
  userId: string,
  name: string
) {
  const result = await db
    .select()
    .from(categories)
    .where(and(eq(categories.userId, userId), eq(categories.name, name)));
  return result[0];
}
