import { createClient } from '@libsql/client';

async function main() {
  const client = createClient({
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });

  console.log('Creating email_verification_tokens table...');

  await client.execute(`
    CREATE TABLE IF NOT EXISTS email_verification_tokens (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      used_at INTEGER,
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    )
  `);

  console.log('Creating indexes...');

  await client.execute(
    `CREATE UNIQUE INDEX IF NOT EXISTS email_verification_token_idx ON email_verification_tokens(token)`
  );

  await client.execute(
    `CREATE INDEX IF NOT EXISTS email_verification_user_idx ON email_verification_tokens(user_id)`
  );

  console.log('Done!');
}

main().catch(console.error);
