/**
 * Script to create a superadmin user
 *
 * Usage:
 *   npx tsx apps/web/src/scripts/create-superadmin.ts <email> <password> [name]
 *
 * Example:
 *   npx tsx apps/web/src/scripts/create-superadmin.ts admin@example.com Admin123! "Admin User"
 */

import { eq } from 'drizzle-orm';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { users } from '../lib/db/schema';
import { hashPassword, generateId } from '../lib/auth/crypto';

async function main() {
  const email = process.argv[2];
  const password = process.argv[3];
  const name = process.argv[4] || 'Admin';

  if (!email || !password) {
    console.error(
      'Usage: npx tsx apps/web/src/scripts/create-superadmin.ts <email> <password> [name]'
    );
    process.exit(1);
  }

  if (password.length < 8) {
    console.error('Error: Password must be at least 8 characters');
    process.exit(1);
  }

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

  const db = drizzle(client);

  // Check if user exists
  const [existingUser] = await db
    .select({ id: users.id, email: users.email, role: users.role })
    .from(users)
    .where(eq(users.email, email.toLowerCase()));

  if (existingUser) {
    if (existingUser.role === 'superadmin') {
      console.log(`User ${email} already exists and is a superadmin`);
      process.exit(0);
    }

    // Update existing user to superadmin
    await db
      .update(users)
      .set({
        role: 'superadmin',
        updatedAt: Date.now(),
      })
      .where(eq(users.id, existingUser.id));

    console.log(`Successfully upgraded ${email} to superadmin`);
    console.log(`Previous role: ${existingUser.role}`);
    console.log(`New role: superadmin`);
    process.exit(0);
  }

  // Create new user
  const userId = generateId();
  const passwordHash = await hashPassword(password);
  const now = Date.now();

  await db.insert(users).values({
    id: userId,
    email: email.toLowerCase(),
    passwordHash,
    name,
    emailVerified: true,
    emailVerifiedAt: now,
    status: 'active',
    role: 'superadmin',
    plan: 'premium',
    createdAt: now,
    updatedAt: now,
  });

  console.log(`Successfully created superadmin user:`);
  console.log(`  Email: ${email}`);
  console.log(`  Name: ${name}`);
  console.log(`  Role: superadmin`);
  console.log(`  Plan: premium`);
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
