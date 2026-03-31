import { neon } from '@neondatabase/serverless';

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('Error: DATABASE_URL environment variable is required');
    process.exit(1);
  }

  const sql = neon(url);

  console.log('Creating email_verification_tokens table...');

  await sql`
    CREATE TABLE IF NOT EXISTS email_verification_tokens (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      used_at INTEGER,
      created_at INTEGER NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::INTEGER
    )
  `;

  console.log('Creating indexes...');

  await sql`CREATE UNIQUE INDEX IF NOT EXISTS email_verification_token_idx ON email_verification_tokens(token)`;

  await sql`CREATE INDEX IF NOT EXISTS email_verification_user_idx ON email_verification_tokens(user_id)`;

  console.log('Done!');
}

main().catch(console.error);
