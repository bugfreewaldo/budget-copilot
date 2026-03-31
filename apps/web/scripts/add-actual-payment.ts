import { config } from 'dotenv';
config({ path: '.env.local' });

import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

async function main() {
  await sql`ALTER TABLE debts ADD COLUMN IF NOT EXISTS actual_payment_cents BIGINT`;
  console.log('Added actual_payment_cents column to debts table');

  const cols =
    await sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'debts' ORDER BY ordinal_position`;
  console.log(
    'Columns:',
    cols.map((c) => c.column_name)
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
