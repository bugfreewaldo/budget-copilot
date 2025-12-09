/**
 * Migration to add role column to users table
 */

import { createClient } from '@libsql/client';

async function main() {
  const databaseUrl = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (!databaseUrl) {
    console.error('Error: TURSO_DATABASE_URL environment variable is required');
    process.exit(1);
  }

  const client = createClient({
    url: databaseUrl,
    authToken,
  });

  console.log('Adding role column to users table...');

  try {
    // Add the role column with default value 'user'
    await client.execute(`
      ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user'
    `);
    console.log('Successfully added role column');
  } catch (err) {
    if (err instanceof Error && err.message.includes('duplicate column')) {
      console.log('Column role already exists');
    } else {
      throw err;
    }
  }

  client.close();
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
