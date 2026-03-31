import { config } from 'dotenv';
config({ path: '.env.local' });

import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

async function main() {
  // Check current columns
  const cols =
    await sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'category_patterns' ORDER BY ordinal_position`;
  console.log(
    'Current columns:',
    cols.map((c) => c.column_name)
  );

  const hasUserId = cols.some((c) => c.column_name === 'user_id');

  if (!hasUserId) {
    // Add user_id column to existing table
    await sql`ALTER TABLE category_patterns ADD COLUMN user_id TEXT NOT NULL DEFAULT ''`;
    console.log('Added user_id column');

    // Create index on user_id
    await sql`CREATE INDEX IF NOT EXISTS pattern_user_idx ON category_patterns(user_id)`;
    console.log('Created pattern_user_idx');
  } else {
    console.log('user_id column already exists');
  }

  // Verify final state
  const finalCols =
    await sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'category_patterns' ORDER BY ordinal_position`;
  console.log(
    'Final columns:',
    finalCols.map((c) => c.column_name)
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
