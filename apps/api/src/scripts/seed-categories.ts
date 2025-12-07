/**
 * Script to add default categories to all existing users
 * Run: pnpm --filter api exec tsx src/scripts/seed-categories.ts
 */

import { initializeDatabase, flushSave } from '../db/client.js';
import { users } from '../db/schema.js';
import { seedDefaultCategoriesForUser } from '../services/categories/index.js';

async function main() {
  console.log('🌱 Seeding default categories for all users...\n');

  const db = await initializeDatabase();

  // Get all active users
  const allUsers = await db.select().from(users);

  console.log(`Found ${allUsers.length} users\n`);

  for (const user of allUsers) {
    console.log(`Processing user: ${user.email} (${user.id})`);
    try {
      await seedDefaultCategoriesForUser(user.id, true); // force=true to add missing categories
    } catch (error) {
      console.error(`  Error for ${user.email}:`, error);
    }
    console.log('');
  }

  await flushSave();
  console.log('\n✅ Done!');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
