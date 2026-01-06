// Load environment variables BEFORE any other imports
// This must be the first import to ensure env vars are available
// when other modules (like @budget-copilot/ai) read process.env
import 'dotenv/config';

import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import { initializeDatabase, flushSave } from '../db/client.js';
import { runMigrations } from '../db/migrate.js';
import { envPlugin } from './plugins/env.js';
import { loggingPlugin } from './plugins/logging.js';
import { securityPlugin } from './plugins/security.js';
import authPlugin from './plugins/auth.js';
import validationPlugin from '../plugins/validation.js';
import problemPlugin from '../plugins/problem.js';
import paginationPlugin from '../plugins/pagination.js';
import idempotencyPlugin from '../plugins/idempotency.js';
import { healthRoutes } from './routes/health.js';
import { debugRoutes } from './routes/debug.js';
import { categoryRoutes as _categoryRoutes } from './routes/categories.js';
import { envelopeRoutes } from './routes/envelopes.js';
import { transactionRoutes } from './routes/transactions.js';
import accountsV1Routes from '../routes/v1/accounts.js';
import categoriesV1Routes from '../routes/v1/categories.js';
import authRoutes from '../routes/v1/auth.js';
import copilotRoutes from '../routes/v1/copilot.js';
import debtsRoutes from '../routes/v1/debts.js';
import goalsRoutes from '../routes/v1/goals.js';
import decisionRoutes from '../routes/v1/decision.js';
import interviewRoutes from '../routes/v1/interview.js';
import { uploadRoutes } from './routes/uploads.js';
import { filesRoutes } from './routes/files.js';
import { cronRoutes } from './routes/cron.js';

/**
 * Bootstrap Fastify server with all plugins and routes
 */
async function buildServer() {
  const server = Fastify({
    logger: {
      level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    },
    requestIdLogLabel: 'reqId',
    disableRequestLogging: false,
    requestIdHeader: 'x-request-id',
  });

  // Register plugins
  await server.register(envPlugin);
  await server.register(loggingPlugin);
  await server.register(securityPlugin);
  await server.register(cookie, {
    secret:
      process.env.COOKIE_SECRET || 'budget-copilot-dev-secret-change-in-prod',
    parseOptions: {},
  });
  await server.register(authPlugin);
  await server.register(validationPlugin);
  await server.register(problemPlugin);
  await server.register(paginationPlugin);
  await server.register(idempotencyPlugin);

  // Initialize database and run migrations
  console.time('db-init');
  await initializeDatabase();
  console.timeEnd('db-init');

  console.time('db-migrate');
  await runMigrations();
  console.timeEnd('db-migrate');

  console.time('db-flush');
  await flushSave();
  console.timeEnd('db-flush');

  // Register routes
  await server.register(healthRoutes);
  await server.register(debugRoutes);
  // await server.register(categoryRoutes, { prefix: '/v1' }); // Old routes - replaced by V1
  await server.register(envelopeRoutes, { prefix: '/v1' });
  await server.register(transactionRoutes, { prefix: '/v1' });

  // Register V1 routes
  await server.register(authRoutes, { prefix: '/v1/auth' });
  await server.register(accountsV1Routes, { prefix: '/v1' });
  await server.register(categoriesV1Routes, { prefix: '/v1' });
  await server.register(copilotRoutes, { prefix: '/v1' });
  await server.register(debtsRoutes, { prefix: '/v1' });
  await server.register(goalsRoutes, { prefix: '/v1' });
  await server.register(decisionRoutes, { prefix: '/v1' });
  await server.register(interviewRoutes, { prefix: '/v1' });

  // File upload routes
  await server.register(uploadRoutes, { prefix: '/v1' });
  await server.register(filesRoutes, { prefix: '/v1' });

  // Cron routes (for background processing)
  await server.register(cronRoutes, { prefix: '/v1' });

  return server;
}

/**
 * Start the server
 */
async function start() {
  const server = await buildServer();

  try {
    const port = Number(process.env.PORT) || 4000;
    const host = process.env.HOST || '0.0.0.0';

    await server.listen({ port, host });

    server.log.info(`🚀 Budget Copilot API running on http://${host}:${port}`);
    server.log.info(`📚 Health check: http://${host}:${port}/health`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
}

// Graceful shutdown
const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];
signals.forEach((signal) => {
  process.on(signal, async () => {
    console.log(`\n${signal} received, shutting down gracefully...`);
    process.exit(0);
  });
});

// Start if run directly (not in test environment)
// On Windows, paths need special handling for import.meta.url comparison
const scriptPath = process.argv[1] ?? '';
const isDirectRun =
  import.meta.url.includes(scriptPath.replace(/\\/g, '/')) ||
  import.meta.url === `file://${scriptPath}` ||
  import.meta.url === `file:///${scriptPath.replace(/\\/g, '/')}`;

if (isDirectRun && process.env.NODE_ENV !== 'test') {
  start();
}

export { buildServer };
