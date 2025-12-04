import { initializeDatabase, flushSave } from './client.js';
import { runMigrations } from './migrate.js';
import * as accountRepo from '../server/lib/repo/accounts.js';
import * as categoryRepo from '../server/lib/repo/categories.js';
import * as envelopeRepo from '../server/lib/repo/envelopes.js';
import * as transactionRepo from '../server/lib/repo/transactions.js';

// Test user ID for development seeding
const TEST_USER_ID = 'test-user-00000000000000000001';

/**
 * Seed database with sample data for development and testing
 * Idempotent: safe to run multiple times
 */
async function seed() {
  console.log('🌱 Seeding database...');

  // Ensure database is initialized and migrated
  const db = await initializeDatabase();
  await runMigrations();

  try {
    // Get current date info
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    // Check if data already exists (idempotency)
    const existingAccounts = await accountRepo.findAllAccounts(
      db,
      TEST_USER_ID
    );
    if (existingAccounts.length > 0) {
      console.log('⏭️  Data already exists, skipping seed');
      return;
    }

    // Create one checking account
    console.log('  Creating account...');
    const account = await accountRepo.createAccount(db, {
      userId: TEST_USER_ID,
      name: 'Main Checking',
      type: 'checking',
      institution: 'Local Bank',
    });

    if (!account) {
      throw new Error('Failed to create account');
    }

    // Create default categories (common expense categories)
    console.log('  Creating categories...');

    const defaultCategories = [
      // Essential expenses
      { name: 'Groceries', emoji: '🛒' },
      { name: 'Utilities', emoji: '💡' },
      { name: 'Rent/Housing', emoji: '🏠' },
      { name: 'Transportation', emoji: '🚗' },
      { name: 'Health', emoji: '🏥' },
      { name: 'Insurance', emoji: '🛡️' },

      // Lifestyle
      { name: 'Shopping', emoji: '🛍️' },
      { name: 'Entertainment', emoji: '🎬' },
      { name: 'Dining Out', emoji: '🍽️' },
      { name: 'Coffee', emoji: '☕' },

      // Personal
      { name: 'Personal Care', emoji: '💇' },
      { name: 'Education', emoji: '📚' },
      { name: 'Fitness', emoji: '🏋️' },
      { name: 'Subscriptions', emoji: '📱' },

      // Financial
      { name: 'Savings', emoji: '💰' },
      { name: 'Investments', emoji: '📈' },
      { name: 'Debt Payments', emoji: '💳' },

      // Other
      { name: 'Gifts', emoji: '🎁' },
      { name: 'Travel', emoji: '✈️' },
      { name: 'Pets', emoji: '🐾' },
      { name: 'Other', emoji: '📦' },
    ];

    const createdCategories: Record<
      string,
      Awaited<ReturnType<typeof categoryRepo.createCategory>>
    > = {};

    for (const cat of defaultCategories) {
      const category = await categoryRepo.createCategory(db, {
        userId: TEST_USER_ID,
        name: cat.name,
        emoji: cat.emoji,
      });
      if (category) {
        createdCategories[cat.name] = category;
      }
    }

    const groceriesCategory = createdCategories['Groceries'];
    const utilitiesCategory = createdCategories['Utilities'];
    const entertainmentCategory = createdCategories['Entertainment'];

    if (!groceriesCategory || !utilitiesCategory || !entertainmentCategory) {
      throw new Error('Failed to create categories');
    }

    // Create three envelopes for current month
    console.log('  Creating envelopes...');
    await envelopeRepo.upsertEnvelope(db, {
      userId: TEST_USER_ID,
      categoryId: groceriesCategory.id,
      month: currentMonth,
      budgetCents: 60000, // $600
    });

    await envelopeRepo.upsertEnvelope(db, {
      userId: TEST_USER_ID,
      categoryId: utilitiesCategory.id,
      month: currentMonth,
      budgetCents: 30000, // $300
    });

    await envelopeRepo.upsertEnvelope(db, {
      userId: TEST_USER_ID,
      categoryId: entertainmentCategory.id,
      month: currentMonth,
      budgetCents: 20000, // $200
    });

    // Create sample transactions
    console.log('  Creating transactions...');

    // Income transaction
    await transactionRepo.createTransaction(db, {
      userId: TEST_USER_ID,
      date: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`,
      description: 'Monthly Salary',
      amountCents: 350000, // $3,500
      type: 'income',
      accountId: account.id,
      cleared: true,
    });

    // Expense transactions
    await transactionRepo.createTransaction(db, {
      userId: TEST_USER_ID,
      date: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-05`,
      description: 'Grocery Store',
      amountCents: -8500, // -$85
      type: 'expense',
      categoryId: groceriesCategory.id,
      accountId: account.id,
      cleared: true,
    });

    await transactionRepo.createTransaction(db, {
      userId: TEST_USER_ID,
      date: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-10`,
      description: 'Electric Bill',
      amountCents: -14500, // -$145
      type: 'expense',
      categoryId: utilitiesCategory.id,
      accountId: account.id,
      cleared: true,
    });

    await transactionRepo.createTransaction(db, {
      userId: TEST_USER_ID,
      date: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-12`,
      description: 'Movie Tickets',
      amountCents: -3200, // -$32
      type: 'expense',
      categoryId: entertainmentCategory.id,
      accountId: account.id,
      cleared: false,
    });

    await transactionRepo.createTransaction(db, {
      userId: TEST_USER_ID,
      date: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-15`,
      description: 'Supermarket',
      amountCents: -12400, // -$124
      type: 'expense',
      categoryId: groceriesCategory.id,
      accountId: account.id,
      cleared: true,
    });

    // Flush to disk
    await flushSave();

    console.log('✅ Seed data created successfully!');
    console.log(`   - 1 account (${account.name})`);
    console.log(
      `   - ${defaultCategories.length} categories (default expense categories)`
    );
    console.log(`   - 3 envelopes for ${currentMonth}`);
    console.log('   - 5 transactions (1 income, 4 expenses)');
  } catch (error) {
    console.error('❌ Seed failed:', error);
    throw error;
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seed()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

export { seed, TEST_USER_ID };
