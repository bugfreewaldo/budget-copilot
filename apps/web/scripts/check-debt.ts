import { config } from 'dotenv';
config({ path: '.env.local' });

import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

async function main() {
  const debts =
    await sql`SELECT id, name, type, current_balance_cents, apr_percent, minimum_payment_cents, minimum_payment_type, minimum_payment_percent, actual_payment_cents, death_date, danger_score, status FROM debts ORDER BY created_at DESC`;

  for (const d of debts) {
    console.log(`\n--- ${d.name} (${d.type}) ---`);
    console.log(`  Balance: $${(d.current_balance_cents / 100).toFixed(2)}`);
    console.log(`  APR: ${d.apr_percent}%`);
    console.log(`  Min payment type: ${d.minimum_payment_type}`);
    console.log(`  Min payment cents: ${d.minimum_payment_cents}`);
    console.log(`  Min payment percent: ${d.minimum_payment_percent}`);
    console.log(`  Actual payment cents: ${d.actual_payment_cents}`);
    console.log(`  Death date: ${d.death_date}`);
    console.log(`  Danger score: ${d.danger_score}`);
    console.log(`  Status: ${d.status}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
