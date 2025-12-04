/**
 * Database exports
 * Re-exports database client and schema for convenience
 */

export {
  getDb,
  initializeDatabase,
  saveDatabase,
  closeDatabase,
  schema,
} from './client.js';
