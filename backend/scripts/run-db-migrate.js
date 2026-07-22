'use strict';

const { spawnSync } = require('node:child_process');
const path = require('node:path');

require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const NODE_ENV_TO_DB_MIGRATE = {
  development: 'dev',
  test: 'test',
  production: 'production',
};

function resolveMigrateEnv() {
  if (process.env.DB_MIGRATE_ENV?.trim()) {
    return process.env.DB_MIGRATE_ENV.trim();
  }
  const nodeEnv = process.env.NODE_ENV?.trim() || 'development';
  return NODE_ENV_TO_DB_MIGRATE[nodeEnv] ?? 'dev';
}

const migrateEnv = resolveMigrateEnv();
const cliArgs = process.argv.slice(2);

if (cliArgs.length === 0) {
  console.error('[migrate] Uso: node scripts/run-db-migrate.js <up|down|status|create> [opciones]');
  process.exit(1);
}

process.env.DB_MIGRATE_ENV = migrateEnv;

console.log(`[migrate] Ambiente db-migrate: ${migrateEnv} (NODE_ENV=${process.env.NODE_ENV ?? 'n/a'})`);

const result = spawnSync(
  'db-migrate',
  [...cliArgs, '-e', migrateEnv, '--config', 'database.js'],
  {
  cwd: path.resolve(__dirname, '..'),
  stdio: 'inherit',
  env: process.env,
  shell: process.platform === 'win32',
});

if (result.error) {
  console.error('[migrate] Error al ejecutar db-migrate:', result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
