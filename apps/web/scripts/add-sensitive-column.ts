import { config } from 'dotenv';
config({ path: '.env.local' });

import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

async function main() {
  // Add sensitive column
  await sql`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS sensitive BOOLEAN NOT NULL DEFAULT false`;
  console.log('Added sensitive column to transactions table');

  // Verify
  const cols =
    await sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'transactions' ORDER BY ordinal_position`;
  console.log(
    'Current columns:',
    cols.map((c) => c.column_name)
  );

  // Check transaction count
  const count = await sql`SELECT COUNT(*) as cnt FROM transactions`;
  console.log('Total transactions in DB:', count[0]?.cnt);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
