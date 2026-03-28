import { createClient, type Client as LibSQLClient } from '@libsql/client';
import { drizzle as drizzleLibSQL } from 'drizzle-orm/libsql';
import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import * as schema from './schema.js';

/**
 * Database client connecting to a libSQL server (sqld)
 *
 * Set LIBSQL_URL to point to your sqld instance (default: http://localhost:8080)
 * Optionally set LIBSQL_AUTH_TOKEN if auth is enabled
 */

export type DatabaseInstance = LibSQLDatabase<typeof schema>;

let dbInstance: DatabaseInstance | null = null;
let libsqlClient: LibSQLClient | null = null;

/**
 * Initialize database connection
 */
export async function initializeDatabase(): Promise<DatabaseInstance> {
  if (dbInstance) {
    return dbInstance;
  }

  const url = process.env.LIBSQL_URL || 'http://localhost:8080';
  const authToken = process.env.LIBSQL_AUTH_TOKEN;

  console.log(`🔗 Connecting to libSQL server at ${url}...`);

  libsqlClient = createClient({ url, authToken });
  dbInstance = drizzleLibSQL(libsqlClient, { schema });

  console.log('✅ Connected to libSQL server');
  return dbInstance;
}

/**
 * Get database instance
 */
export async function getDb(): Promise<DatabaseInstance> {
  if (!dbInstance) {
    return await initializeDatabase();
  }
  return dbInstance;
}

/**
 * Save database — no-op, sqld handles persistence
 */
export function saveDatabase(): void {
  // sqld handles persistence automatically
}

/**
 * Flush any pending save — no-op, sqld handles persistence
 */
export async function flushSave(): Promise<void> {
  // sqld handles persistence automatically
}

/**
 * Close database connection
 */
export function closeDatabase(): void {
  if (libsqlClient) {
    libsqlClient.close();
    libsqlClient = null;
  }
  dbInstance = null;
}

// Process exit handlers
process.on('SIGINT', () => {
  closeDatabase();
  process.exit(0);
});
process.on('SIGTERM', () => {
  closeDatabase();
  process.exit(0);
});

export { schema };
