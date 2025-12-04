import { getDb } from '../db/client.js';
import { accounts, categories, envelopes, transactions } from '../db/schema.js';

/**
 * Test data reset helpers
 * Provides utilities to clean database state between tests
 */

export async function truncateAll() {
  const db = await getDb();

  // Delete in order to respect foreign key constraints
  await db.delete(transactions);
  await db.delete(envelopes);
  await db.delete(categories);
  await db.delete(accounts);
}
