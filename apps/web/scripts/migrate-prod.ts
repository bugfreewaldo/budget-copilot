/**
 * Production migration script
 * Run with: npx tsx scripts/migrate-prod.ts
 */

import { createClient } from '@libsql/client';

const db = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

const migrations = [
  // 1. Add term_months column to debts table
  `ALTER TABLE debts ADD COLUMN term_months INTEGER;`,

  // 2. Create uploaded_files table
  `CREATE TABLE IF NOT EXISTS uploaded_files (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    filename TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    size_bytes INTEGER NOT NULL,
    storage_key TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'stored',
    failure_reason TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );`,

  // 3. Create indexes for uploaded_files
  `CREATE INDEX IF NOT EXISTS uploaded_file_user_idx ON uploaded_files(user_id);`,
  `CREATE INDEX IF NOT EXISTS uploaded_file_status_idx ON uploaded_files(status);`,
  `CREATE UNIQUE INDEX IF NOT EXISTS uploaded_file_storage_key_idx ON uploaded_files(storage_key);`,

  // 4. Create file_parsed_summaries table
  `CREATE TABLE IF NOT EXISTS file_parsed_summaries (
    id TEXT PRIMARY KEY,
    file_id TEXT NOT NULL,
    parser_version TEXT NOT NULL,
    document_type TEXT NOT NULL,
    summary_json TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );`,

  // 5. Create indexes for file_parsed_summaries
  `CREATE INDEX IF NOT EXISTS parsed_summary_file_idx ON file_parsed_summaries(file_id);`,
  `CREATE INDEX IF NOT EXISTS parsed_summary_version_idx ON file_parsed_summaries(parser_version);`,

  // 6. Create file_imported_items table
  `CREATE TABLE IF NOT EXISTS file_imported_items (
    id TEXT PRIMARY KEY,
    file_id TEXT NOT NULL,
    parsed_item_id TEXT NOT NULL,
    transaction_id TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );`,

  // 7. Create indexes for file_imported_items
  `CREATE INDEX IF NOT EXISTS imported_item_file_idx ON file_imported_items(file_id);`,
  `CREATE INDEX IF NOT EXISTS imported_item_transaction_idx ON file_imported_items(transaction_id);`,
  `CREATE UNIQUE INDEX IF NOT EXISTS imported_item_unique_idx ON file_imported_items(file_id, parsed_item_id);`,
];

async function runMigrations() {
  console.log('Starting migrations...');

  for (const sql of migrations) {
    try {
      console.log(`Running: ${sql.slice(0, 60)}...`);
      await db.execute(sql);
      console.log('  ✓ Success');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      // Ignore "duplicate column" or "already exists" errors
      if (
        message.includes('duplicate column') ||
        message.includes('already exists')
      ) {
        console.log('  ⊘ Already exists (skipped)');
      } else {
        console.error('  ✗ Error:', message);
      }
    }
  }

  console.log('\nMigrations complete!');
}

runMigrations().catch(console.error);
