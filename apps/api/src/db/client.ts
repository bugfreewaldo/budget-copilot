import { drizzle as drizzleBetterSqlite } from 'drizzle-orm/better-sqlite3';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as fsSync from 'node:fs';
import * as schema from './schema.js';

/**
 * Database client using SQL.js (local file-based SQLite)
 */

export type DatabaseInstance = BetterSQLite3Database<typeof schema>;

interface SqlJsDatabase {
  prepare: (sql: string) => SqlJsStatement;
  run: (sql: string) => void;
  exec: (sql: string) => void;
  export: () => Uint8Array;
  close: () => void;
}

interface SqlJsStatement {
  bind: (params: unknown[]) => void;
  step: () => boolean;
  get: () => unknown[];
  getAsObject: () => Record<string, unknown>;
  reset: () => void;
  free: () => void;
}

interface SqlJsStatic {
  Database: new (data?: Uint8Array) => SqlJsDatabase;
}

let dbInstance: DatabaseInstance | null = null;
let sqlJsDb: SqlJsDatabase | null = null;
let SQL: SqlJsStatic | null = null;
let isDirty = false;
let saveTimer: NodeJS.Timeout | null = null;
const SAVE_DEBOUNCE_MS = 150;

/**
 * Initialize database connection
 */
export async function initializeDatabase(): Promise<DatabaseInstance> {
  if (dbInstance) {
    return dbInstance;
  }

  console.log('📂 Using local SQL.js database...');
  dbInstance = await initializeSqlJs();
  return dbInstance;
}

/**
 * Initialize SQL.js for local development
 */
async function initializeSqlJs(): Promise<
  BetterSQLite3Database<typeof schema>
> {
  const initSqlJs = (await import('sql.js')).default;
  const fs = await import('node:fs');
  const path = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const { config } = await import('../config.js');

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  if (!SQL) {
    // Find WASM file
    const candidates = [
      path.resolve(process.cwd(), 'apps/api/sql-wasm.wasm'),
      path.resolve(process.cwd(), 'apps/api/dist/sql-wasm.wasm'),
      path.resolve(__dirname, '../../sql-wasm.wasm'),
      path.resolve(__dirname, '../../dist/sql-wasm.wasm'),
      path.resolve(__dirname, '../../node_modules/sql.js/dist/sql-wasm.wasm'),
    ];

    let wasmPath: string | null = null;
    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        wasmPath = candidate;
        break;
      }
    }

    if (!wasmPath) {
      throw new Error(
        `WASM file not found in any of: ${candidates.join(', ')}`
      );
    }

    console.log(`[initDB] Loading WASM from: ${wasmPath}`);

    const wasmBuffer = fs.readFileSync(wasmPath);
    const wasmBinary = wasmBuffer.buffer.slice(
      wasmBuffer.byteOffset,
      wasmBuffer.byteOffset + wasmBuffer.byteLength
    );

    SQL = (await initSqlJs({ wasmBinary })) as unknown as SqlJsStatic;
  }

  const dbPath = process.env.DATABASE_URL || config.databaseUrl;

  if (dbPath === ':memory:') {
    sqlJsDb = new SQL.Database();
  } else {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    try {
      const stats = fs.statSync(dbPath);
      if (stats.size > 0) {
        const buffer = fs.readFileSync(dbPath);
        sqlJsDb = new SQL.Database(new Uint8Array(buffer));
        console.log(
          `📂 Loaded existing database from ${dbPath} (${stats.size} bytes)`
        );
      } else {
        sqlJsDb = new SQL.Database();
        isDirty = true;
        console.log(
          `📝 Created new database (empty file existed at ${dbPath})`
        );
      }
    } catch {
      sqlJsDb = new SQL.Database();
      isDirty = true;
      console.log(`📝 Created new database at ${dbPath}`);
    }
  }

  const sqliteCompatible = createBetterSqlite3Adapter(sqlJsDb);
  return drizzleBetterSqlite(sqliteCompatible, { schema });
}

/**
 * Get database instance
 */
export async function getDb(): Promise<DatabaseInstance> {
  if (!dbInstance) {
    return await initializeDatabase();
  }
  return dbInstance;
}

/**
 * Save database to disk
 */
export function saveDatabase(): void {
  if (!sqlJsDb) return;
  queueSave();
}

/**
 * Flush any pending save immediately
 */
export async function flushSave(): Promise<void> {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  flushSaveSync();
}

/**
 * Close database connection
 */
export function closeDatabase(): void {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }

  if (sqlJsDb) {
    flushSaveSync();
    sqlJsDb.close();
    sqlJsDb = null;
  }

  dbInstance = null;
}

// ============================================================================
// SQL.js helpers
// ============================================================================

function queueSave(): void {
  const dbPath = process.env.DATABASE_URL;
  if (!dbPath || dbPath === ':memory:') {
    return;
  }

  isDirty = true;

  if (saveTimer) {
    clearTimeout(saveTimer);
  }

  saveTimer = setTimeout(() => {
    flushSaveSync();
  }, SAVE_DEBOUNCE_MS);
}

function flushSaveSync(): void {
  const dbPath = process.env.DATABASE_URL;
  if (!sqlJsDb || !dbPath || dbPath === ':memory:' || !isDirty) {
    return;
  }

  try {
    const tmpPath = `${dbPath}.tmp`;
    const data = sqlJsDb.export();
    const buffer = Buffer.from(data);

    fsSync.writeFileSync(tmpPath, buffer);
    fsSync.renameSync(tmpPath, dbPath);

    isDirty = false;
    console.log(`💾 Saved database to ${dbPath} (${buffer.length} bytes)`);
  } catch (error) {
    console.error('❌ Failed to save database:', error);
    throw error;
  }
}

function createBetterSqlite3Adapter(sqlJsDb: SqlJsDatabase) {
  let inTransaction = false;

  const isMutatingStatement = (sql: string): boolean => {
    const normalized = sql.trim().toUpperCase();
    return (
      normalized.startsWith('INSERT') ||
      normalized.startsWith('UPDATE') ||
      normalized.startsWith('DELETE') ||
      normalized.startsWith('CREATE') ||
      normalized.startsWith('ALTER') ||
      normalized.startsWith('DROP') ||
      normalized.startsWith('REPLACE')
    );
  };

  return {
    prepare: (sql: string) => {
      const normalized = sql.trim().toUpperCase();
      const isBegin = normalized.startsWith('BEGIN');
      const isCommit = normalized.startsWith('COMMIT');
      const isRollback = normalized.startsWith('ROLLBACK');

      let stmt: SqlJsStatement | null = null;
      if (!isBegin && !isCommit && !isRollback) {
        try {
          stmt = sqlJsDb.prepare(sql);
        } catch (error) {
          console.error(`Failed to prepare statement: ${sql}`, error);
          throw error;
        }
      }

      return {
        run: (...params: unknown[]) => {
          if (isBegin) {
            inTransaction = true;
            sqlJsDb.run('BEGIN');
            return { changes: 0, lastInsertRowid: 0 };
          }
          if (isCommit) {
            sqlJsDb.run('COMMIT');
            inTransaction = false;
            queueSave();
            return { changes: 0, lastInsertRowid: 0 };
          }
          if (isRollback) {
            sqlJsDb.run('ROLLBACK');
            inTransaction = false;
            return { changes: 0, lastInsertRowid: 0 };
          }

          stmt.bind(params as never[]);
          stmt.step();
          stmt.reset();

          if (isMutatingStatement(sql) && !inTransaction) {
            queueSave();
          }

          return { changes: 1, lastInsertRowid: 0 };
        },

        get: (...params: unknown[]) => {
          stmt.bind(params as never[]);
          let result = undefined;
          if (stmt.step()) {
            result = stmt.getAsObject();
          }
          stmt.reset();
          return result;
        },

        all: (...params: unknown[]) => {
          stmt.bind(params as never[]);
          const rows: unknown[] = [];
          while (stmt.step()) {
            rows.push(stmt.getAsObject());
          }
          stmt.reset();
          return rows;
        },

        values: (...params: unknown[]) => {
          stmt.bind(params as never[]);
          const rows: unknown[][] = [];
          while (stmt.step()) {
            rows.push(stmt.get());
          }
          stmt.reset();
          return rows;
        },

        raw: function () {
          return {
            get: (...params: unknown[]) => {
              let ownStmt: SqlJsStatement | null = null;
              try {
                ownStmt = sqlJsDb.prepare(sql);
                ownStmt.bind(params as never[]);
                let result = undefined;
                if (ownStmt.step()) {
                  result = ownStmt.get();
                }
                return result;
              } finally {
                if (ownStmt) {
                  try {
                    ownStmt.free();
                  } catch {
                    /* ignore */
                  }
                }
              }
            },
            all: (...params: unknown[]) => {
              let ownStmt: SqlJsStatement | null = null;
              try {
                ownStmt = sqlJsDb.prepare(sql);
                ownStmt.bind(params as never[]);
                const rows: unknown[][] = [];
                while (ownStmt.step()) {
                  rows.push(ownStmt.get());
                }
                return rows;
              } finally {
                if (ownStmt) {
                  try {
                    ownStmt.free();
                  } catch {
                    /* ignore */
                  }
                }
              }
            },
          };
        },

        finalize: () => {},
      };
    },

    exec: (sql: string) => {
      sqlJsDb.exec(sql);
      if (isMutatingStatement(sql)) {
        queueSave();
      }
    },
  };
}

// Process exit handlers
process.on('exit', () => closeDatabase());
process.on('beforeExit', () => flushSaveSync());
process.on('SIGINT', () => {
  closeDatabase();
  process.exit(0);
});
process.on('SIGTERM', () => {
  closeDatabase();
  process.exit(0);
});
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception, closing database...', error);
  closeDatabase();
  process.exit(1);
});

export { schema };
