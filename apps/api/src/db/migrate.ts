import 'dotenv/config';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { migrate } from 'drizzle-orm/neon-http/migrator';

/**
 * Run database migrations for Neon PostgreSQL
 * Uses Drizzle Kit generated migrations from ./drizzle folder
 */
export async function runMigrations() {
  console.log('🔄 Running migrations...');

  const url = process.env.DATABASE_URL;

  if (!url) {
    throw new Error(
      'Missing DATABASE_URL environment variable. Set it to your Neon PostgreSQL connection string.'
    );
  }

  const sql = neon(url);
  const db = drizzle(sql);

  try {
    await migrate(db, { migrationsFolder: './drizzle' });
    console.log('✅ Migrations completed successfully');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run directly when called as a script
const isDirectRun = process.argv[1]?.includes('migrate');
if (isDirectRun) {
  runMigrations();
}
