/**
 * Create scheduled_bills and scheduled_income tables in libSQL
 */

import { createClient } from '@libsql/client';
import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../.env.local') });

async function main() {
  const url = process.env.LIBSQL_URL || process.env.TURSO_DATABASE_URL;
  const authToken = process.env.LIBSQL_AUTH_TOKEN || process.env.TURSO_AUTH_TOKEN;

  if (!url) {
    console.error('Missing LIBSQL_URL environment variable');
    process.exit(1);
  }

  console.log('🔄 Connecting to libSQL...');
  const client = createClient({ url, authToken });

  console.log('📝 Creating scheduled_bills table...');
  await client.execute(`
    CREATE TABLE IF NOT EXISTS scheduled_bills (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('mortgage', 'rent', 'auto_loan', 'credit_card', 'personal_loan', 'student_loan', 'utility', 'insurance', 'subscription', 'other')),
      amount_cents INTEGER NOT NULL,
      due_day INTEGER NOT NULL,
      frequency TEXT NOT NULL DEFAULT 'monthly' CHECK(frequency IN ('weekly', 'biweekly', 'monthly', 'quarterly', 'annually')),
      category_id TEXT,
      linked_debt_id TEXT,
      auto_pay INTEGER DEFAULT 0,
      reminder_days_before INTEGER DEFAULT 3,
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'paused', 'completed')),
      next_due_date TEXT,
      last_paid_date TEXT,
      notes TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `);

  await client.execute(`CREATE INDEX IF NOT EXISTS scheduled_bill_user_idx ON scheduled_bills(user_id)`);
  await client.execute(`CREATE INDEX IF NOT EXISTS scheduled_bill_due_idx ON scheduled_bills(due_day)`);
  await client.execute(`CREATE INDEX IF NOT EXISTS scheduled_bill_status_idx ON scheduled_bills(status)`);

  console.log('📝 Creating scheduled_income table...');
  await client.execute(`
    CREATE TABLE IF NOT EXISTS scheduled_income (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      source TEXT NOT NULL CHECK(source IN ('salary', 'freelance', 'business', 'investment', 'rental', 'side_hustle', 'bonus', 'other')),
      amount_cents INTEGER NOT NULL,
      pay_day INTEGER NOT NULL,
      frequency TEXT NOT NULL DEFAULT 'monthly' CHECK(frequency IN ('weekly', 'biweekly', 'semimonthly', 'monthly')),
      account_id TEXT,
      is_variable INTEGER DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'paused', 'ended')),
      next_pay_date TEXT,
      last_received_date TEXT,
      notes TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `);

  await client.execute(`CREATE INDEX IF NOT EXISTS scheduled_income_user_idx ON scheduled_income(user_id)`);
  await client.execute(`CREATE INDEX IF NOT EXISTS scheduled_income_payday_idx ON scheduled_income(pay_day)`);
  await client.execute(`CREATE INDEX IF NOT EXISTS scheduled_income_status_idx ON scheduled_income(status)`);

  console.log('✅ Tables created successfully!');

  // Verify
  const bills = await client.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='scheduled_bills'");
  const income = await client.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='scheduled_income'");
  console.log('📋 Verification:');
  console.log('  - scheduled_bills:', bills.rows.length > 0 ? '✓' : '✗');
  console.log('  - scheduled_income:', income.rows.length > 0 ? '✓' : '✗');

  client.close();
}

main().catch(console.error);
