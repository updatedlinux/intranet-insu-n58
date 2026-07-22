'use strict';

const path = require('node:path');

require('dotenv').config({ path: path.resolve(__dirname, '.env') });

function parseBoolean(value, fallback = false) {
  if (value === undefined || value === '') return fallback;
  const normalized = String(value).trim().toLowerCase();
  return normalized === 'true' || normalized === '1' || normalized === 'yes';
}

function parsePort(value, fallback = 1433) {
  const port = Number(value);
  return Number.isInteger(port) && port > 0 ? port : fallback;
}

function requireEnv(key) {
  const value = process.env[key]?.trim();
  if (!value) {
    throw new Error(`[database.js] Variable requerida "${key}" no definida en .env`);
  }
  return value;
}

function buildConnectionConfig() {
  const encrypt = parseBoolean(process.env.DB_ENCRYPT, false);

  return {
    driver: 'mssql',
    server: requireEnv('DB_SERVER'),
    port: parsePort(process.env.DB_PORT, 1433),
    database: requireEnv('DB_NAME'),
    user: requireEnv('DB_USER'),
    password: requireEnv('DB_PASSWORD'),
    options: {
      encrypt,
      trustServerCertificate: !encrypt,
      enableArithAbort: true,
    },
  };
}

const connection = buildConnectionConfig();

module.exports = {
  defaultEnv: process.env.DB_MIGRATE_ENV || 'dev',
  dev: connection,
  test: connection,
  production: connection,
};
