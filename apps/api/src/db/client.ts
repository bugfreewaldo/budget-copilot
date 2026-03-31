import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';
import * as schema from './schema.js';

/**
 * Database client connecting to Neon PostgreSQL
 *
 * Set DATABASE_URL to your Neon connection string
 */

export type DatabaseInstance = NeonHttpDatabase<typeof schema>;

let dbInstance: DatabaseInstance | null = null;

/**
 * Initialize database connection
 */
export async function initializeDatabase(): Promise<DatabaseInstance> {
  if (dbInstance) {
    return dbInstance;
  }

  const url = process.env.DATABASE_URL;

  if (!url) {
    throw new Error(
      'Missing DATABASE_URL environment variable. Set it to your Neon PostgreSQL connection string.'
    );
  }

  console.log(`🔗 Connecting to Neon PostgreSQL...`);

  const sql = neon(url);
  dbInstance = drizzle(sql, { schema });

  console.log('✅ Connected to Neon PostgreSQL');
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
 * Save database — no-op, Neon handles persistence
 */
export function saveDatabase(): void {
  // Neon handles persistence automatically
}

/**
 * Flush any pending save — no-op, Neon handles persistence
 */
export async function flushSave(): Promise<void> {
  // Neon handles persistence automatically
}

/**
 * Close database connection
 */
export function closeDatabase(): void {
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
