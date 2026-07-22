#!/bin/sh
set -e

export DB_HOST="${DB_SERVER:-127.0.0.1}"
export DB_PORT="${DB_PORT:-1433}"
MAX_ATTEMPTS="${DB_WAIT_ATTEMPTS:-240}"
SLEEP_SEC="${DB_WAIT_SLEEP_SEC:-5}"

echo "[entrypoint] SQL ${DB_HOST}:${DB_PORT} | MinIO ${MINIO_ENDPOINT:-?}:${MINIO_PORT:-9000} | Redis ${REDIS_HOST:-?}:${REDIS_PORT:-6379}"

wait_tcp() {
  name="$1"
  host="$2"
  port="$3"
  attempt=0
  echo "[entrypoint] Esperando ${name} en ${host}:${port}..."
  while [ "$attempt" -lt "$MAX_ATTEMPTS" ]; do
    if node <<NODE
const net = require('node:net');
const socket = net.createConnection({ host: '${host}', port: ${port} }, () => {
  socket.end();
  process.exit(0);
});
socket.setTimeout(3000);
socket.on('timeout', () => { socket.destroy(); process.exit(1); });
socket.on('error', () => process.exit(1));
NODE
    then
      echo "[entrypoint] ${name} disponible."
      return 0
    fi
    attempt=$((attempt + 1))
    sleep "$SLEEP_SEC"
  done
  echo "[entrypoint] ${name} no respondió a tiempo." >&2
  return 1
}

wait_tcp "SQL Server" "${DB_HOST}" "${DB_PORT}"
wait_tcp "MinIO" "${MINIO_ENDPOINT:-127.0.0.1}" "${MINIO_PORT:-9000}"
wait_tcp "Redis" "${REDIS_HOST:-127.0.0.1}" "${REDIS_PORT:-6379}"

echo "[entrypoint] Verificando base de datos ${DB_NAME:-insular_intranet}..."
node <<'NODE'
const sql = require('mssql');

async function ensureDatabase() {
  const dbName = (process.env.DB_NAME || 'insular_intranet').trim();
  const config = {
    server: process.env.DB_SERVER || process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 1433),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: 'master',
    options: {
      encrypt: process.env.DB_ENCRYPT === 'true',
      trustServerCertificate: process.env.DB_ENCRYPT !== 'true',
      enableArithAbort: true,
    },
  };

  if (!config.user || !config.password) {
    throw new Error('DB_USER y DB_PASSWORD son requeridos para crear la base de datos.');
  }

  const pool = await sql.connect(config);
  try {
    const safeName = dbName.replace(/]/g, ']]');
    const check = await pool
      .request()
      .input('name', sql.NVarChar, dbName)
      .query('SELECT name FROM sys.databases WHERE name = @name');

    if (check.recordset.length === 0) {
      await pool.request().query(`CREATE DATABASE [${safeName}]`);
      console.log(`[entrypoint] Base de datos ${dbName} creada.`);
    } else {
      console.log(`[entrypoint] Base de datos ${dbName} ya existe.`);
    }
  } finally {
    await pool.close();
  }
}

ensureDatabase()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('[entrypoint] Error al preparar la base de datos:', error.message);
    process.exit(1);
  });
NODE

echo "[entrypoint] Aplicando migraciones..."
npm run migrate

echo "[entrypoint] Iniciando API..."
exec node dist/index.js
