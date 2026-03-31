import { config } from 'dotenv';
config({ path: '.env.local' });

import { neon } from '@neondatabase/serverless';
const sql = neon(process.env.DATABASE_URL!);

async function main() {
  const debts =
    await sql`SELECT current_balance_cents, minimum_payment_cents, actual_payment_cents, apr_percent, minimum_payment_type, minimum_payment_percent FROM debts LIMIT 1`;
  const d = debts[0]!;

  console.log('Raw values and types:');
  for (const [key, val] of Object.entries(d)) {
    console.log(`  ${key}: ${JSON.stringify(val)} (${typeof val})`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
