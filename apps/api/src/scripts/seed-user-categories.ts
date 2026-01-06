/**
 * Script to seed default categories for a specific user
 * Run with: npx tsx apps/api/src/scripts/seed-user-categories.ts <userId>
 */

import { seedDefaultCategoriesForUser } from '../services/categories/index.js';
import { getDb } from '../db/client.js';
import { users } from '../db/schema.js';
import { eq } from 'drizzle-orm';

async function main() {
  const userId = process.argv[2];

  if (!userId) {
    // If no userId provided, list all users and let them choose
    const db = await getDb();
    const allUsers = await db
      .select({ id: users.id, email: users.email, name: users.name })
      .from(users);

    console.log('\n📋 Available users:');
    console.log('==================');
    for (const user of allUsers) {
      console.log(`  ID: ${user.id}`);
      console.log(`  Email: ${user.email}`);
      console.log(`  Name: ${user.name || 'N/A'}`);
      console.log('---');
    }

    console.log(
      '\n💡 Usage: npx tsx apps/api/src/scripts/seed-user-categories.ts <userId>'
    );
    console.log(
      '   Or use "all" to seed for all users: npx tsx apps/api/src/scripts/seed-user-categories.ts all'
    );
    process.exit(0);
  }

  const db = await getDb();

  if (userId === 'all') {
    // Seed for all users
    const allUsers = await db
      .select({ id: users.id, email: users.email })
      .from(users);
    console.log(`\n🌱 Seeding categories for ${allUsers.length} users...\n`);

    for (const user of allUsers) {
      console.log(`\n👤 Processing user: ${user.email}`);
      await seedDefaultCategoriesForUser(user.id, true);
    }

    console.log('\n✅ Done! Categories seeded for all users.');
  } else {
    // Seed for specific user
    const [user] = await db.select().from(users).where(eq(users.id, userId));

    if (!user) {
      console.error(`❌ User not found with ID: ${userId}`);
      process.exit(1);
    }

    console.log(`\n👤 Seeding categories for user: ${user.email}`);
    await seedDefaultCategoriesForUser(userId, true);
    console.log('\n✅ Done!');
  }
}

main().catch((err) => {
  console.error('❌ Error:', err);
  process.exit(1);
});
