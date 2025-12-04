import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import type { DatabaseInstance } from '../../../db/client.js';
import { accounts } from '../../../db/schema.js';
import type { CreateAccountInput } from '../../schemas/accounts.js';

/**
 * Account repository
 * Data access layer for accounts table
 */

export async function findAllAccounts(
  db: DatabaseInstance,
  userId?: string
) {
  if (userId) {
    return await db.select().from(accounts).where(eq(accounts.userId, userId));
  }
  return await db.select().from(accounts);
}

export async function findAccountById(
  db: DatabaseInstance,
  id: string
) {
  const result = await db.select().from(accounts).where(eq(accounts.id, id));
  return result[0];
}

export async function createAccount(
  db: DatabaseInstance,
  input: CreateAccountInput & { userId: string }
) {
  const id = nanoid();
  const now = Date.now();

  await db.insert(accounts).values({
    id,
    userId: input.userId,
    name: input.name,
    institution: input.institution || null,
    type: input.type,
    createdAt: now,
  });

  return await findAccountById(db, id);
}
