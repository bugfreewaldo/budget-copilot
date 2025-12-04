import { createClient, type Client as LibSQLClient } from '@libsql/client';
import { drizzle as drizzleLibSQL } from 'drizzle-orm/libsql';
import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import * as schema from './schema';

/**
 * Database client for Vercel serverless environment
 * Uses Turso (LibSQL) for edge-optimized SQLite
 */

export type DatabaseInstance = LibSQLDatabase<typeof schema>;

let libsqlClient: LibSQLClient | null = null;
let dbInstance: DatabaseInstance | null = null;

/**
 * Get database connection
 * Creates a singleton connection per serverless function invocation
 */
export function getDb(): DatabaseInstance {
  if (dbInstance) {
    return dbInstance;
  }

  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (!url || !authToken) {
    throw new Error(
      'Missing TURSO_DATABASE_URL or TURSO_AUTH_TOKEN environment variables'
    );
  }

  libsqlClient = createClient({
    url,
    authToken,
  });

  dbInstance = drizzleLibSQL(libsqlClient, { schema });
  return dbInstance;
}

/**
 * Close database connection (for cleanup if needed)
 */
export function closeDb(): void {
  if (libsqlClient) {
    libsqlClient.close();
    libsqlClient = null;
    dbInstance = null;
  }
}

export { schema };
