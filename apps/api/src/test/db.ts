import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { flushSave, closeDatabase } from '../db/client.js';

/**
 * Test DB isolation helpers
 * Provides unique DB files per test suite to avoid SQL.js concurrency issues
 */

export function makeUniqueDbPath(prefix = 'budget') {
  const rand = crypto.randomBytes(4).toString('hex');
  const timestamp = Date.now();
  const stamp = `${process.pid}.${timestamp}.${rand}`;
  const cwd = process.cwd();
  const dir = path.join(cwd, 'data', 'test');

  // Ensure directory exists
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const dbPath = path.join(dir, `${prefix}.${stamp}.db`);
  return dbPath;
}

export async function setupIsolatedDb() {
  const dbPath = makeUniqueDbPath();
  const prev = process.env.DATABASE_URL;
  process.env.DATABASE_URL = dbPath;

  // Don't initialize here - let buildServer() do it
  // This avoids double initialization and ensures singleton pattern works

  async function teardown() {
    await flushSave();
    closeDatabase();
    try {
      fs.rmSync(dbPath, { force: true });
    } catch {
      // Ignore cleanup errors
    }
  }

  function restoreEnv() {
    if (prev === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = prev;
  }

  return { dbPath, teardown, restoreEnv };
}
