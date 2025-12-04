import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';

/**
 * Tests for SQL.js database persistence
 * These tests verify that data is properly saved to disk and can be reloaded
 */

describe('Database Persistence', () => {
  let tempDir: string;
  let testDbPath: string;
  let originalEnv: string | undefined;

  beforeEach(() => {
    // Create temporary directory for test database
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'budget-test-'));
    testDbPath = path.join(tempDir, 'test.db');

    // Save original DATABASE_URL
    originalEnv = process.env.DATABASE_URL;

    // Set test database path
    process.env.DATABASE_URL = testDbPath;
  });

  afterEach(() => {
    // Restore original DATABASE_URL
    if (originalEnv) {
      process.env.DATABASE_URL = originalEnv;
    } else {
      delete process.env.DATABASE_URL;
    }

    // Clean up temp directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }

    // Clear module cache to allow fresh initialization
    // This simulates a process restart
    delete require.cache[require.resolve('./client.js')];
  });

  it('should persist data to disk and reload it', async () => {
    // Import fresh client module
    const { initializeDatabase, flushSave, closeDatabase } = await import(
      './client.js'
    );
    const { runMigrations } = await import('./migrate.js');

    // Phase 1: Create database and insert data
    {
      const db = await initializeDatabase();
      await runMigrations();

      // Insert test data using raw SQL
      await db.run({
        sql: `INSERT INTO accounts (id, name, type, institution, created_at)
              VALUES (?, ?, ?, ?, ?)`,
        params: [
          'test-account-1',
          'Test Account',
          'checking',
          'Test Bank',
          Date.now(),
        ],
      });

      // Flush to disk
      await flushSave();

      // Verify file exists and has content
      expect(fs.existsSync(testDbPath)).toBe(true);
      const stats = fs.statSync(testDbPath);
      expect(stats.size).toBeGreaterThan(0);

      console.log(`Database file created: ${stats.size} bytes`);

      // Close database
      closeDatabase();
    }

    // Clear module cache to simulate process restart
    delete require.cache[require.resolve('./client.js')];
    delete require.cache[require.resolve('./config.js')];

    // Phase 2: Reload database and verify data persists
    {
      const { initializeDatabase: initDb2, closeDatabase: closeDb2 } =
        await import('./client.js');

      const db = await initDb2();

      // Query for the inserted account
      const results = await db
        .select()
        .from((await import('./schema.js')).accounts);

      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('test-account-1');
      expect(results[0].name).toBe('Test Account');
      expect(results[0].type).toBe('checking');

      console.log('Data successfully persisted and reloaded!');

      closeDb2();
    }
  });

  it('should not create file for :memory: database', async () => {
    // Set to memory mode
    process.env.DATABASE_URL = ':memory:';

    const { initializeDatabase, flushSave, closeDatabase } = await import(
      './client.js'
    );
    const { runMigrations } = await import('./migrate.js');

    const db = await initializeDatabase();
    await runMigrations();

    // Insert test data
    await db.run({
      sql: `INSERT INTO accounts (id, name, type, institution, created_at)
            VALUES (?, ?, ?, ?, ?)`,
      params: ['mem-account', 'Memory Account', 'savings', null, Date.now()],
    });

    // Try to flush (should be no-op for :memory:)
    await flushSave();

    // Verify no file was created
    expect(fs.existsSync(testDbPath)).toBe(false);

    console.log('In-memory database correctly skipped file persistence');

    closeDatabase();
  });

  it('should handle concurrent writes with debounced save', async () => {
    const { initializeDatabase, flushSave, closeDatabase } = await import(
      './client.js'
    );
    const { runMigrations } = await import('./migrate.js');

    const db = await initializeDatabase();
    await runMigrations();

    // Insert multiple records quickly (should trigger debounced save)
    for (let i = 0; i < 10; i++) {
      await db.run({
        sql: `INSERT INTO accounts (id, name, type, institution, created_at)
              VALUES (?, ?, ?, ?, ?)`,
        params: [`account-${i}`, `Account ${i}`, 'checking', null, Date.now()],
      });
    }

    // Flush explicitly
    await flushSave();

    // Verify all records are saved
    expect(fs.existsSync(testDbPath)).toBe(true);
    const stats = fs.statSync(testDbPath);
    expect(stats.size).toBeGreaterThan(0);

    closeDatabase();

    // Reload and verify count
    delete require.cache[require.resolve('./client.js')];

    const { initializeDatabase: initDb2, closeDatabase: closeDb2 } =
      await import('./client.js');
    const db2 = await initDb2();

    const results = await db2
      .select()
      .from((await import('./schema.js')).accounts);

    expect(results).toHaveLength(10);

    console.log(`All ${results.length} records persisted correctly`);

    closeDb2();
  });
});
