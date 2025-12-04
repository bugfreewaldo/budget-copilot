/**
 * DEPRECATED: This file is kept for backwards compatibility only.
 * The server entry point has moved to ./server/index.ts
 *
 * Please update your scripts to use:
 * - dev: tsx src/server/index.ts
 * - build & start: node dist/server/index.js
 */

console.warn(
  '\n⚠️  WARNING: Running from deprecated entry point (src/index.ts)\n' +
  '   Please use: tsx src/server/index.ts instead\n'
);

// Re-export the new server for backwards compatibility
export * from './server/index.js';
