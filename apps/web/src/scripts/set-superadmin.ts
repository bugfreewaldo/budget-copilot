/**
 * Script to set a user as superadmin
 *
 * Usage:
 *   npx tsx apps/web/src/scripts/set-superadmin.ts <email>
 *
 * Example:
 *   npx tsx apps/web/src/scripts/set-superadmin.ts admin@example.com
 */

import { eq } from 'drizzle-orm';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { users } from '../lib/db/schema';

async function main() {
  const email = process.argv[2];

  if (!email) {
    console.error(
      'Usage: npx tsx apps/web/src/scripts/set-superadmin.ts <email>'
    );
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

  // Find user
  const [user] = await db
    .select({ id: users.id, email: users.email, role: users.role })
    .from(users)
    .where(eq(users.email, email));

  if (!user) {
    console.error(`Error: User with email "${email}" not found`);
    process.exit(1);
  }

  if (user.role === 'superadmin') {
    console.log(`User ${email} is already a superadmin`);
    process.exit(0);
  }

  // Update role
  await db
    .update(users)
    .set({
      role: 'superadmin',
      updatedAt: Date.now(),
    })
    .where(eq(users.id, user.id));

  console.log(`Successfully set ${email} as superadmin`);
  console.log(`Previous role: ${user.role}`);
  console.log(`New role: superadmin`);
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
