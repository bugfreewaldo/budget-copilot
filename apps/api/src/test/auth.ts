import { nanoid } from 'nanoid';
import { eq } from 'drizzle-orm';
import { getDb } from '../db/client.js';
import { users } from '../db/schema.js';

/**
 * Test authentication helpers
 * Provides utilities for creating test users and managing authentication in tests
 */

export interface TestUser {
  id: string;
  email: string;
  name: string;
  plan: 'free' | 'pro' | 'premium';
}

/**
 * Create a test user in the database
 * Does NOT require authentication - for testing purposes only
 */
export async function createTestUser(
  overrides: Partial<TestUser> = {}
): Promise<TestUser> {
  const db = await getDb();
  const now = Date.now();

  const testUser: TestUser = {
    id: overrides.id || nanoid(),
    email: overrides.email || `test-${nanoid()}@example.com`,
    name: overrides.name || 'Test User',
    plan: overrides.plan || 'free',
  };

  await db.insert(users).values({
    id: testUser.id,
    email: testUser.email,
    passwordHash: 'test-hash-not-real', // Tests don't need real password hash
    name: testUser.name,
    emailVerified: true,
    status: 'active',
    plan: testUser.plan,
    createdAt: now,
    updatedAt: now,
  });

  return testUser;
}

/**
 * Delete a test user from the database
 */
export async function deleteTestUser(userId: string): Promise<void> {
  const db = await getDb();
  await db.delete(users).where(eq(users.id, userId));
}
