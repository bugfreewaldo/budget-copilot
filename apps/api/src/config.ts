import 'dotenv/config';
import { z } from 'zod';

/**
 * Environment configuration with validation
 */
const configSchema = z.object({
  nodeEnv: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  port: z.coerce.number().default(4000),
  host: z.string().default('0.0.0.0'),
  databaseUrl: z.string().default('./data/budget.db'),
  llmProvider: z.enum(['openai', 'claude']).default('openai'),
  openaiApiKey: z.string().optional(),
  anthropicApiKey: z.string().optional(),
  corsOrigin: z.string().default('http://localhost:3000'),
});

export const config = configSchema.parse({
  nodeEnv: process.env.NODE_ENV,
  port: process.env.PORT,
  host: process.env.HOST,
  databaseUrl: process.env.DATABASE_URL,
  llmProvider: process.env.LLM_PROVIDER,
  openaiApiKey: process.env.OPENAI_API_KEY,
  anthropicApiKey: process.env.ANTHROPIC_API_KEY,
  corsOrigin: process.env.CORS_ORIGIN,
});

export type Config = z.infer<typeof configSchema>;
