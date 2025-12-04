#!/usr/bin/env node
/**
 * Copy sql.js WASM file to predictable locations for dev and production
 * Runs on postinstall to ensure WASM is available regardless of tsx/ts-node/node runtime
 */

const fs = require('fs');
const path = require('path');

const targets = [
  path.join(__dirname, '../sql-wasm.wasm'),           // apps/api/sql-wasm.wasm (dev)
  path.join(__dirname, '../dist/sql-wasm.wasm'),      // apps/api/dist/sql-wasm.wasm (prod)
];

try {
  // Resolve source WASM from node_modules
  const source = require.resolve('sql.js/dist/sql-wasm.wasm');
  console.log(`[copy-wasm] Source: ${source}`);

  targets.forEach((target) => {
    const dir = path.dirname(target);

    // Ensure target directory exists
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Copy WASM file
    fs.copyFileSync(source, target);
    const stats = fs.statSync(target);
    console.log(`[copy-wasm] ✓ Copied to ${target} (${stats.size} bytes)`);
  });

  console.log('[copy-wasm] SQL.js WASM ready for dev and production');
} catch (error) {
  console.error('[copy-wasm] Failed to copy WASM file:', error.message);
  process.exit(1);
}
