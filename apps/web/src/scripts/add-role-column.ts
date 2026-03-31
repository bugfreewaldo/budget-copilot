/**
 * Migration to add role column to users table
 */

import { neon } from '@neondatabase/serverless';

async function main() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error('Error: DATABASE_URL environment variable is required');
    process.exit(1);
  }

  const sql = neon(databaseUrl);

  console.log('Adding role column to users table...');

  try {
    // Add the role column with default value 'user'
    await sql`
      ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user'
    `;
    console.log('Successfully added role column');
  } catch (err) {
    if (err instanceof Error && err.message.includes('already exists')) {
      console.log('Column role already exists');
    } else {
      throw err;
    }
  }
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
