import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';
import * as schema from './schema';

/**
 * Database client for Vercel serverless environment
 * Connects to Neon PostgreSQL
 */

export type DatabaseInstance = NeonHttpDatabase<typeof schema>;

let dbInstance: DatabaseInstance | null = null;

/**
 * Get database connection
 * Creates a singleton connection per serverless function invocation
 */
export function getDb(): DatabaseInstance {
  if (dbInstance) {
    return dbInstance;
  }

  const url = process.env.DATABASE_URL;

  if (!url) {
    throw new Error(
      'Missing DATABASE_URL environment variable. Set it to your Neon PostgreSQL connection string.'
    );
  }

  const sql = neon(url);
  dbInstance = drizzle(sql, { schema });
  return dbInstance;
}

/**
 * Close database connection (for cleanup if needed)
 */
export function closeDb(): void {
  dbInstance = null;
}

export { schema };
