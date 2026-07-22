#!/usr/bin/env node
'use strict';

/**
 * Puesta en cero de datos operativos (post-pruebas).
 *
 * Conserva: tabla Roles y el esquema completo.
 * Elimina: usuarios, áreas, catálogos, tickets, documentos, tableros, inventario, etc.
 * Recrea: área raíz, cargo admin, usuario administrador y tablero kanban por defecto.
 *
 * USO (solo simulación — no modifica la BD):
 *   npm run data:reset
 *   node scripts/reset-data-to-zero.js
 *
 * USO (ejecución real):
 *   RESET_DATA_CONFIRM=yes npm run data:reset -- --execute
 *
 * Opciones / variables:
 *   --execute                    Aplica cambios (sin esto solo muestra resumen)
 *   RESET_DATA_CONFIRM=yes       Obligatorio con --execute
 *   RESET_DATA_ALLOW_PRODUCTION=yes  Permite ejecutar con NODE_ENV=production
 *   RESET_ADMIN_EMAIL            Email del admin recreado (default: admin@yopmail.com)
 *   SEED_ADMIN_PASSWORD          Contraseña del admin recreado (default: ChangeMe123!)
 *   RESET_CLEAR_MINIO=yes        Vacía el bucket MinIO configurado en .env
 *   RESET_FLUSH_REDIS=yes        Borra claves session:* en Redis (si REDIS_ENABLED)
 *
 * NOTA: Los archivos en MinIO no se borran salvo RESET_CLEAR_MINIO=yes.
 */

const path = require('node:path');
const bcrypt = require('bcrypt');
const sql = require('mssql');

require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const EXECUTE = process.argv.includes('--execute');
const DEFAULT_ADMIN_EMAIL = 'admin@yopmail.com';
const DEFAULT_PASSWORD = 'ChangeMe123!';
const BOOTSTRAP_AREA = 'Dirección General';
const BOOTSTRAP_POSITION = 'Administrador del Sistema';

const COUNT_QUERIES = [
  ['Usuarios', 'SELECT COUNT(*) AS n FROM dbo.Users'],
  ['Áreas', 'SELECT COUNT(*) AS n FROM dbo.Areas'],
  ['Cargos', 'SELECT COUNT(*) AS n FROM dbo.Positions'],
  ['Colaboradores activos', 'SELECT COUNT(*) AS n FROM dbo.Users WHERE isActive = 1'],
  ['Tickets', 'SELECT COUNT(*) AS n FROM dbo.Tickets'],
  ['Solicitudes', 'SELECT COUNT(*) AS n FROM dbo.Requests'],
  ['Documentos', 'SELECT COUNT(*) AS n FROM dbo.Documents'],
  ['Tareas (kanban)', 'SELECT COUNT(*) AS n FROM dbo.Tasks'],
  ['Activos TI', 'SELECT COUNT(*) AS n FROM dbo.Assets'],
  ['Etiquetas', 'SELECT COUNT(*) AS n FROM dbo.Tags'],
  ['Categorías tickets', 'SELECT COUNT(*) AS n FROM dbo.TicketCategories'],
];

function buildSqlConfig() {
  const server = process.env.DB_SERVER?.trim();
  const database = process.env.DB_NAME?.trim();
  const user = process.env.DB_USER?.trim();
  const password = process.env.DB_PASSWORD;
  if (!server || !database || !user || password == null) {
    throw new Error('Faltan variables DB_SERVER, DB_NAME, DB_USER o DB_PASSWORD en .env');
  }
  const encrypt = process.env.DB_ENCRYPT === 'true';
  return {
    server,
    port: Number(process.env.DB_PORT ?? 1433),
    database,
    user,
    password,
    options: {
      encrypt,
      trustServerCertificate: !encrypt,
    },
  };
}

function assertCanExecute() {
  if (!EXECUTE) return;

  if (process.env.RESET_DATA_CONFIRM !== 'yes') {
    console.error(
      '[reset] Ejecución bloqueada: defina RESET_DATA_CONFIRM=yes para confirmar la puesta en cero.',
    );
    process.exit(1);
  }

  const nodeEnv = process.env.NODE_ENV?.trim() || 'development';
  if (nodeEnv === 'production' && process.env.RESET_DATA_ALLOW_PRODUCTION !== 'yes') {
    console.error(
      '[reset] NODE_ENV=production detectado. Defina RESET_DATA_ALLOW_PRODUCTION=yes si realmente desea continuar.',
    );
    process.exit(1);
  }
}

async function fetchCounts(pool) {
  const counts = {};
  for (const [label, query] of COUNT_QUERIES) {
    const result = await pool.request().query(query);
    counts[label] = result.recordset[0]?.n ?? 0;
  }
  const roles = await pool.request().query(`SELECT COUNT(*) AS n FROM dbo.Roles`);
  counts['Roles (se conservan)'] = roles.recordset[0]?.n ?? 0;
  return counts;
}

function printSummary(counts, adminEmail) {
  console.log('\n=== Puesta en cero — resumen ===\n');
  console.log(`Base de datos : ${process.env.DB_NAME} @ ${process.env.DB_SERVER}`);
  console.log(`Modo          : ${EXECUTE ? 'EJECUTAR (destructivo)' : 'simulación (dry-run)'}`);
  console.log(`Admin final   : ${adminEmail}\n`);
  console.log('Estado actual:');
  for (const [label, value] of Object.entries(counts)) {
    console.log(`  ${label.padEnd(24)} ${value}`);
  }
  console.log('\nSe eliminará todo lo operativo y se recreará:');
  console.log(`  • Área: ${BOOTSTRAP_AREA}`);
  console.log(`  • Cargo: ${BOOTSTRAP_POSITION}`);
  console.log(`  • Usuario admin: ${adminEmail} (rol admin, mustChangePassword=1)`);
  console.log('  • Tablero kanban con columnas por defecto');
  console.log('  • Roles existentes: sin cambios\n');
  if (!EXECUTE) {
    console.log('Para ejecutar de verdad:');
    console.log('  RESET_DATA_CONFIRM=yes npm run data:reset -- --execute\n');
  }
}

function buildResetSql(passwordHashEscaped) {
  const adminEmail = (process.env.RESET_ADMIN_EMAIL?.trim() || DEFAULT_ADMIN_EMAIL).replace(
    /'/g,
    "''",
  );

  return `
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRANSACTION;

    -- Romper referencias opcionales / jerárquicas
    IF COL_LENGTH('dbo.Requests', 'linkedTaskId') IS NOT NULL
      UPDATE dbo.Requests SET linkedTaskId = NULL WHERE linkedTaskId IS NOT NULL;

    IF OBJECT_ID('dbo.Folders', 'U') IS NOT NULL
      UPDATE dbo.Folders SET parentFolderId = NULL WHERE parentFolderId IS NOT NULL;

    UPDATE dbo.Users SET createdBy = NULL WHERE createdBy IS NOT NULL;

    -- Reuniones
    IF OBJECT_ID('dbo.MeetingReminderLog', 'U') IS NOT NULL DELETE FROM dbo.MeetingReminderLog;
    IF OBJECT_ID('dbo.MeetingExternalAttendees', 'U') IS NOT NULL DELETE FROM dbo.MeetingExternalAttendees;
    IF OBJECT_ID('dbo.MeetingAttendees', 'U') IS NOT NULL DELETE FROM dbo.MeetingAttendees;
    IF OBJECT_ID('dbo.Meetings', 'U') IS NOT NULL DELETE FROM dbo.Meetings;

    -- Eventos corporativos
    IF OBJECT_ID('dbo.CorporateEventAreas', 'U') IS NOT NULL DELETE FROM dbo.CorporateEventAreas;
    IF OBJECT_ID('dbo.CorporateEvents', 'U') IS NOT NULL DELETE FROM dbo.CorporateEvents;

    -- Aprendizaje
    IF OBJECT_ID('dbo.LearningUserProgress', 'U') IS NOT NULL DELETE FROM dbo.LearningUserProgress;
    IF OBJECT_ID('dbo.LearningCourseExceptions', 'U') IS NOT NULL DELETE FROM dbo.LearningCourseExceptions;
    IF OBJECT_ID('dbo.LearningLessons', 'U') IS NOT NULL DELETE FROM dbo.LearningLessons;
    IF OBJECT_ID('dbo.LearningModules', 'U') IS NOT NULL DELETE FROM dbo.LearningModules;
    IF OBJECT_ID('dbo.LearningCourseAccess', 'U') IS NOT NULL DELETE FROM dbo.LearningCourseAccess;
    IF OBJECT_ID('dbo.LearningCourses', 'U') IS NOT NULL DELETE FROM dbo.LearningCourses;

    -- Solicitudes internas
    IF OBJECT_ID('dbo.RequestStatusHistory', 'U') IS NOT NULL DELETE FROM dbo.RequestStatusHistory;
    IF OBJECT_ID('dbo.Requests', 'U') IS NOT NULL DELETE FROM dbo.Requests;

    -- Mesa de ayuda
    IF OBJECT_ID('dbo.TicketAttachments', 'U') IS NOT NULL DELETE FROM dbo.TicketAttachments;
    IF OBJECT_ID('dbo.TicketComments', 'U') IS NOT NULL DELETE FROM dbo.TicketComments;
    IF OBJECT_ID('dbo.Tickets', 'U') IS NOT NULL DELETE FROM dbo.Tickets;

    -- Tableros / tareas
    IF OBJECT_ID('dbo.TaskActivityLog', 'U') IS NOT NULL DELETE FROM dbo.TaskActivityLog;
    IF OBJECT_ID('dbo.TaskComments', 'U') IS NOT NULL DELETE FROM dbo.TaskComments;
    IF OBJECT_ID('dbo.TaskAttachments', 'U') IS NOT NULL DELETE FROM dbo.TaskAttachments;
    IF OBJECT_ID('dbo.TaskAssignees', 'U') IS NOT NULL DELETE FROM dbo.TaskAssignees;
    IF OBJECT_ID('dbo.TaskTags', 'U') IS NOT NULL DELETE FROM dbo.TaskTags;
    IF OBJECT_ID('dbo.Tasks', 'U') IS NOT NULL DELETE FROM dbo.Tasks;
    IF OBJECT_ID('dbo.BoardColumns', 'U') IS NOT NULL DELETE FROM dbo.BoardColumns;
    IF OBJECT_ID('dbo.Boards', 'U') IS NOT NULL DELETE FROM dbo.Boards;

    -- Inventario TI
    IF OBJECT_ID('dbo.InventoryStockAlertLog', 'U') IS NOT NULL DELETE FROM dbo.InventoryStockAlertLog;
    IF OBJECT_ID('dbo.StockMovements', 'U') IS NOT NULL DELETE FROM dbo.StockMovements;
    IF OBJECT_ID('dbo.AssetMaintenanceLogs', 'U') IS NOT NULL DELETE FROM dbo.AssetMaintenanceLogs;
    IF OBJECT_ID('dbo.AssetAssignmentHistory', 'U') IS NOT NULL DELETE FROM dbo.AssetAssignmentHistory;
    IF OBJECT_ID('dbo.Assets', 'U') IS NOT NULL DELETE FROM dbo.Assets;
    IF OBJECT_ID('dbo.Consumables', 'U') IS NOT NULL DELETE FROM dbo.Consumables;
    IF OBJECT_ID('dbo.AssetCategories', 'U') IS NOT NULL DELETE FROM dbo.AssetCategories;
    IF OBJECT_ID('dbo.ConsumableCategories', 'U') IS NOT NULL DELETE FROM dbo.ConsumableCategories;

    -- Documentos
    IF OBJECT_ID('dbo.DocumentLogs', 'U') IS NOT NULL DELETE FROM dbo.DocumentLogs;
    IF OBJECT_ID('dbo.DocumentTags', 'U') IS NOT NULL DELETE FROM dbo.DocumentTags;
    IF OBJECT_ID('dbo.DocumentVersions', 'U') IS NOT NULL DELETE FROM dbo.DocumentVersions;
    IF OBJECT_ID('dbo.Documents', 'U') IS NOT NULL DELETE FROM dbo.Documents;
    IF OBJECT_ID('dbo.Folders', 'U') IS NOT NULL DELETE FROM dbo.Folders;

    -- Comunicados
    IF OBJECT_ID('dbo.Announcements', 'U') IS NOT NULL DELETE FROM dbo.Announcements;

    -- Chat
    IF OBJECT_ID('dbo.ChatMessages', 'U') IS NOT NULL DELETE FROM dbo.ChatMessages;
    IF OBJECT_ID('dbo.ChatParticipants', 'U') IS NOT NULL DELETE FROM dbo.ChatParticipants;
    IF OBJECT_ID('dbo.ChatRooms', 'U') IS NOT NULL DELETE FROM dbo.ChatRooms;
    IF OBJECT_ID('dbo.ChatAreaAccess', 'U') IS NOT NULL DELETE FROM dbo.ChatAreaAccess;

    -- Accesos y auditoría
    IF OBJECT_ID('dbo.AreaAccess', 'U') IS NOT NULL DELETE FROM dbo.AreaAccess;
    IF OBJECT_ID('dbo.Notifications', 'U') IS NOT NULL DELETE FROM dbo.Notifications;
    IF OBJECT_ID('dbo.AuditLogs', 'U') IS NOT NULL DELETE FROM dbo.AuditLogs;
    IF OBJECT_ID('dbo.AreaLeaders', 'U') IS NOT NULL DELETE FROM dbo.AreaLeaders;

    -- Usuarios y catálogos organizacionales
    DELETE FROM dbo.Users;
    DELETE FROM dbo.Positions;
    IF OBJECT_ID('dbo.Tags', 'U') IS NOT NULL DELETE FROM dbo.Tags;
    IF OBJECT_ID('dbo.TicketCategories', 'U') IS NOT NULL DELETE FROM dbo.TicketCategories;

    UPDATE dbo.Areas SET parentAreaId = NULL;
    DELETE FROM dbo.Areas;

    -- Bootstrap mínimo (roles intactos)
    DECLARE @roleId INT = (
      SELECT TOP 1 id FROM dbo.Roles WHERE name = N'admin' AND isActive = 1
    );
    IF @roleId IS NULL
      SELECT TOP 1 @roleId = id FROM dbo.Roles WHERE name = N'superadmin' AND isActive = 1;
    IF @roleId IS NULL
      THROW 50001, 'No existe rol admin ni superadmin. Ejecute migraciones primero.', 1;

    DECLARE @areaId INT;
    DECLARE @positionId INT;
    DECLARE @boardId INT;

    INSERT INTO dbo.Areas (name, description, parentAreaId, isActive, isItSupportArea)
    VALUES (
      N'${BOOTSTRAP_AREA}',
      N'Área raíz recreada tras puesta en cero',
      NULL,
      1,
      0
    );
    SET @areaId = SCOPE_IDENTITY();

    INSERT INTO dbo.Positions (name, areaId, isLeader, isActive)
    VALUES (N'${BOOTSTRAP_POSITION}', @areaId, 0, 1);
    SET @positionId = SCOPE_IDENTITY();

    INSERT INTO dbo.Users (
      firstName, lastName, email, passwordHash,
      roleId, areaId, positionId,
      isActive, mustChangePassword, createdBy
    )
    VALUES (
      N'Administrador', N'N58', N'${adminEmail}', N'${passwordHashEscaped}',
      @roleId, @areaId, @positionId,
      1, 1, NULL
    );

    INSERT INTO dbo.Boards (areaId, name)
    VALUES (@areaId, N'Tablero ${BOOTSTRAP_AREA}');
    SET @boardId = SCOPE_IDENTITY();

    INSERT INTO dbo.BoardColumns (boardId, name, [order], color, defaultStatus)
    VALUES
      (@boardId, N'Por Hacer', 0, N'#64748b', N'OPEN'),
      (@boardId, N'En Progreso', 1, N'#0369a1', N'IN_PROGRESS'),
      (@boardId, N'En Revisión', 2, N'#b45309', N'IN_REVIEW'),
      (@boardId, N'Completado', 3, N'#15803d', N'DONE');

    COMMIT TRANSACTION;
  `;
}

async function clearMinioBucketIfRequested() {
  if (process.env.RESET_CLEAR_MINIO !== 'yes') return;

  if (process.env.MINIO_ENABLED === 'false') {
    console.log('[reset] MinIO deshabilitado (MINIO_ENABLED=false); se omite limpieza de archivos.');
    return;
  }

  const endpoint = process.env.MINIO_ENDPOINT?.trim();
  const accessKey = process.env.MINIO_ACCESS_KEY?.trim();
  const secretKey = process.env.MINIO_SECRET_KEY;
  const bucket = process.env.MINIO_BUCKET?.trim();
  if (!endpoint || !accessKey || secretKey == null || !bucket) {
    console.warn('[reset] RESET_CLEAR_MINIO=yes pero faltan variables MinIO; se omite.');
    return;
  }

  const { S3Client, ListObjectsV2Command, DeleteObjectsCommand } = await import(
    '@aws-sdk/client-s3'
  );
  const useSSL = process.env.MINIO_USE_SSL === 'true';
  const port = Number(process.env.MINIO_PORT ?? 9000);
  const client = new S3Client({
    endpoint: `${useSSL ? 'https' : 'http'}://${endpoint}:${port}`,
    region: 'us-east-1',
    credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
    forcePathStyle: true,
  });

  let deleted = 0;
  let token;
  do {
    const list = await client.send(
      new ListObjectsV2Command({ Bucket: bucket, ContinuationToken: token }),
    );
    const keys = (list.Contents ?? []).map((o) => ({ Key: o.Key })).filter((o) => o.Key);
    if (keys.length > 0) {
      await client.send(new DeleteObjectsCommand({ Bucket: bucket, Delete: { Objects: keys } }));
      deleted += keys.length;
    }
    token = list.IsTruncated ? list.NextContinuationToken : undefined;
  } while (token);

  console.log(`[reset] MinIO: ${deleted} objeto(s) eliminado(s) del bucket "${bucket}".`);
}

async function flushRedisSessionsIfRequested() {
  if (process.env.RESET_FLUSH_REDIS !== 'yes') return;
  if (process.env.REDIS_ENABLED === 'false') {
    console.log('[reset] Redis deshabilitado; se omite flush de sesiones.');
    return;
  }

  const Redis = require('ioredis');
  const host = process.env.REDIS_HOST?.trim();
  if (!host) {
    console.warn('[reset] RESET_FLUSH_REDIS=yes pero falta REDIS_HOST; se omite.');
    return;
  }

  const redis = new Redis({
    host,
    port: Number(process.env.REDIS_PORT ?? 6379),
    password: process.env.REDIS_PASSWORD || undefined,
    lazyConnect: true,
  });

  await redis.connect();
  const keys = await redis.keys('session:*');
  if (keys.length > 0) await redis.del(...keys);
  await redis.quit();
  console.log(`[reset] Redis: ${keys.length} sesión(es) eliminada(s).`);
}

async function main() {
  assertCanExecute();

  const adminEmail = process.env.RESET_ADMIN_EMAIL?.trim() || DEFAULT_ADMIN_EMAIL;
  const pool = await sql.connect(buildSqlConfig());

  try {
    const counts = await fetchCounts(pool);
    printSummary(counts, adminEmail);

    if (!EXECUTE) {
      return;
    }

    const password =
      process.env.SEED_ADMIN_PASSWORD?.trim() ||
      process.env.RESET_ADMIN_PASSWORD?.trim() ||
      DEFAULT_PASSWORD;
    const passwordHash = await bcrypt.hash(password, 12);
    const escapedHash = passwordHash.replace(/'/g, "''");

    console.log('[reset] Ejecutando puesta en cero en transacción SQL…');
    await pool.request().query(buildResetSql(escapedHash));
    console.log('[reset] Base de datos restablecida correctamente.');

    await clearMinioBucketIfRequested();
    await flushRedisSessionsIfRequested();

    const after = await fetchCounts(pool);
    console.log('\nEstado final:');
    for (const [label, value] of Object.entries(after)) {
      console.log(`  ${label.padEnd(24)} ${value}`);
    }
    console.log(`\n[reset] Inicie sesión con ${adminEmail} y la contraseña configurada (SEED_ADMIN_PASSWORD).`);
  } finally {
    await pool.close();
  }
}

main().catch((error) => {
  console.error('[reset] Error:', error instanceof Error ? error.message : error);
  process.exit(1);
});
