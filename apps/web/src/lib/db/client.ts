import { createClient, type Client as LibSQLClient } from '@libsql/client';
import { drizzle as drizzleLibSQL } from 'drizzle-orm/libsql';
import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import * as schema from './schema';

/**
 * Database client for Vercel serverless environment
 * Connects to a libSQL server (self-hosted sqld or Turso-compatible)
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

  const url = process.env.LIBSQL_URL || process.env.TURSO_DATABASE_URL;
  const authToken =
    process.env.LIBSQL_AUTH_TOKEN || process.env.TURSO_AUTH_TOKEN;

  if (!url) {
    throw new Error(
      'Missing LIBSQL_URL environment variable. Set it to your libSQL server URL (e.g. http://your-tunnel.example.com)'
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
