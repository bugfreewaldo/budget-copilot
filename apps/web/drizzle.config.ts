import type { Config } from 'drizzle-kit';

export default {
  schema: './src/lib/db/schema.ts',
  out: './drizzle',
  dialect: 'sqlite',
  dbCredentials: {
    url:
      process.env.LIBSQL_URL ||
      process.env.DATABASE_URL ||
      'file:../api/data/budget.db',
  },
} satisfies Config;
