import { closeDatabase } from '../db/client.js';

/**
 * Test DB helpers
 * Tests connect to the Neon PostgreSQL instance (use DATABASE_URL env var)
 */

export async function setupIsolatedDb() {
  const prev = process.env.DATABASE_URL;
  // Tests use the DATABASE_URL from environment
  if (!process.env.DATABASE_URL) {
    process.env.DATABASE_URL =
      'postgresql://localhost:5432/budget_copilot_test';
  }

  async function teardown() {
    closeDatabase();
  }

  function restoreEnv() {
    if (prev === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = prev;
  }

  return { teardown, restoreEnv };
}
