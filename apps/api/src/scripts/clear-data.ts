import 'dotenv/config';
import { getDb } from '../db/client.js';
import { sql } from 'drizzle-orm';

/**
 * Clear all data from the database
 * Keeps the schema intact but removes all rows
 */
async function clearAllData() {
  console.log('🗑️  Clearing all data from database...');

  const db = await getDb();

  // Delete in order to respect foreign key constraints
  const tables = [
    'debt_payments',
    'debts',
    'transaction_inbox',
    'documents',
    'category_patterns',
    'recurring_transactions',
    'spending_patterns',
    'monthly_snapshots',
    'daily_forecasts',
    'cash_runway',
    'alerts',
    'goals',
    'daily_summaries',
    'transactions',
    'envelopes',
    'categories',
    'accounts',
    'sessions',
    'password_reset_tokens',
    'email_verification_tokens',
    'oauth_connections',
    'users',
  ];

  for (const table of tables) {
    try {
      await db.run(sql.raw(`DELETE FROM ${table}`));
      console.log(`  ✓ Cleared ${table}`);
    } catch (error) {
      // Table might not exist, skip
      console.log(`  - Skipped ${table} (may not exist)`);
    }
  }

  console.log('\n✅ All data cleared successfully!');
  console.log('\n🚀 The app is ready for fresh data.');
  console.log('   Users can now register and start adding their finances!');
}

clearAllData()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Failed to clear data:', err);
    process.exit(1);
  });
