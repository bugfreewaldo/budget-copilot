import { closeDatabase } from '../db/client.js';

/**
 * Test DB helpers
 * Tests connect to the same sqld instance (use LIBSQL_URL env var)
 */

export async function setupIsolatedDb() {
  const prev = process.env.LIBSQL_URL;
  // Tests use the same sqld instance
  process.env.LIBSQL_URL = process.env.LIBSQL_URL || 'http://localhost:8080';

  async function teardown() {
    closeDatabase();
  }

  function restoreEnv() {
    if (prev === undefined) delete process.env.LIBSQL_URL;
    else process.env.LIBSQL_URL = prev;
  }

  return { teardown, restoreEnv };
}
