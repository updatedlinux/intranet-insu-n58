#!/usr/bin/env node
'use strict';

/**
 * Smoke E2E Solicitudes Internas:
 * - Colaborador crea solicitud hacia área TI
 * - Líder: Rafael Torres (soyrafaeltorres.la@gmail.com) gestiona desde bandeja
 * - Colaborador cierra solicitud resuelta
 *
 * Uso: npm run smoke:requests
 * Requiere: API en marcha, migraciones 24 y 25 aplicadas.
 */

require('dotenv').config();

const bcrypt = require('bcrypt');
const sql = require('mssql');

const BASE = process.env.SMOKE_API_URL ?? 'http://localhost:3000/api/v1';
const COOKIE_NAME = process.env.AUTH_COOKIE_NAME ?? 'intranet_session';

const COLLABORATOR_EMAIL = process.env.SMOKE_COLLABORATOR_EMAIL ?? 'colaborador@yopmail.com';
const LEADER_EMAIL = process.env.SMOKE_IT_LEADER_EMAIL ?? 'soyrafaeltorres.la@gmail.com';

const DEFAULT_PASSWORD = process.env.SEED_COLLABORATOR_PASSWORD?.trim()
  || process.env.SEED_ADMIN_PASSWORD?.trim()
  || 'ChangeMe123!';
const TEST_PASSWORD = process.env.SMOKE_TEST_PASSWORD ?? 'TestDocFlow2026!';
const LEADER_PASSWORD = process.env.SMOKE_IT_LEADER_PASSWORD?.trim() || TEST_PASSWORD;

const TARGET_AREA_NAMES = ['Infraestructura Tecnológica', 'TI'];
const SMOKE_TITLE = `Smoke solicitud interna ${Date.now()}`;
const SMOKE_DESCRIPTION =
  'Solicitud generada por smoke-requests.js para certificar flujo colaborador → líder → cierre.';

function dbConfig() {
  return {
    server: process.env.DB_SERVER,
    port: Number(process.env.DB_PORT ?? 1433),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    options: {
      encrypt: process.env.DB_ENCRYPT === 'true',
      trustServerCertificate: process.env.DB_ENCRYPT !== 'true',
    },
  };
}

async function withPool(fn) {
  const pool = await sql.connect(dbConfig());
  try {
    return await fn(pool);
  } finally {
    await pool.close();
  }
}

async function assertRequestsTableExists() {
  await withPool(async (pool) => {
    const result = await pool.request().query(`
      SELECT OBJECT_ID('dbo.Requests', 'U') AS tableId
    `);
    assert(result.recordset[0]?.tableId != null, 'Tabla dbo.Requests no existe. Ejecute: npm run migrate');
  });
}

async function clearLoginRateLimit(email) {
  if (!process.env.REDIS_HOST?.trim()) return;
  const Redis = require('ioredis');
  const client = new Redis({
    host: process.env.REDIS_HOST,
    port: Number(process.env.REDIS_PORT ?? 6379),
    password: process.env.REDIS_PASSWORD || undefined,
  });
  try {
    await client.del(`login:attempts:${email.trim().toLowerCase()}`);
  } finally {
    await client.quit();
  }
}

async function ensureExistingUserLoginPassword(email, plainPassword) {
  const passwordHash = await bcrypt.hash(plainPassword, 12);
  await withPool(async (pool) => {
    const result = await pool
      .request()
      .input('email', sql.NVarChar(255), email.trim().toLowerCase())
      .input('passwordHash', sql.NVarChar(255), passwordHash)
      .query(`
        UPDATE dbo.Users
        SET passwordHash = @passwordHash,
            mustChangePassword = 0,
            updatedAt = SYSUTCDATETIME()
        WHERE LOWER(email) = @email
      `);
    if ((result.rowsAffected[0] ?? 0) === 0) {
      throw new Error(`No se encontró usuario: ${email}`);
    }
  });
}

async function getUserByEmail(email) {
  return withPool(async (pool) => {
    const result = await pool
      .request()
      .input('email', sql.NVarChar(255), email.trim().toLowerCase())
      .query(`
        SELECT u.id, u.firstName, u.lastName, u.email, u.isActive,
               a.id AS areaId, a.name AS areaName,
               p.isLeader AS positionIsLeader
        FROM dbo.Users u
        INNER JOIN dbo.Areas a ON u.areaId = a.id
        INNER JOIN dbo.Positions p ON u.positionId = p.id
        WHERE LOWER(u.email) = @email
      `);
    return result.recordset[0] ?? null;
  });
}

async function getTargetAreaId() {
  return withPool(async (pool) => {
    const result = await pool.request().query(`
      SELECT TOP 1 id, name
      FROM dbo.Areas
      WHERE name IN (N'Infraestructura Tecnológica', N'TI') AND isActive = 1
      ORDER BY CASE WHEN name = N'Infraestructura Tecnológica' THEN 0 ELSE 1 END
    `);
    return result.recordset[0] ?? null;
  });
}

async function ensureAreaLeader(areaId, userId) {
  await withPool(async (pool) => {
    await pool
      .request()
      .input('areaId', sql.Int, areaId)
      .input('userId', sql.Int, userId)
      .query(`
        IF NOT EXISTS (
          SELECT 1 FROM dbo.AreaLeaders WHERE areaId = @areaId AND userId = @userId
        )
        INSERT INTO dbo.AreaLeaders (areaId, userId) VALUES (@areaId, @userId)
      `);
  });
}

async function ensureTiLeaderPosition(userId) {
  await withPool(async (pool) => {
    await pool.request().input('userId', sql.Int, userId).query(`
      UPDATE p
      SET isLeader = 1, isActive = 1
      FROM dbo.Positions p
      INNER JOIN dbo.Users u ON u.positionId = p.id
      WHERE u.id = @userId
    `);
  });
}

async function countRequestNotifications(userId, requestId, type) {
  return withPool(async (pool) => {
    const result = await pool
      .request()
      .input('userId', sql.Int, userId)
      .input('requestId', sql.Int, requestId)
      .input('type', sql.NVarChar(40), type)
      .query(`
        SELECT COUNT(*) AS total
        FROM dbo.Notifications
        WHERE userId = @userId
          AND type = @type
          AND resourceType = N'request'
          AND resourceId = @requestId
      `);
    return result.recordset[0]?.total ?? 0;
  });
}

async function countStatusHistory(requestId, toStatus) {
  return withPool(async (pool) => {
    const result = await pool
      .request()
      .input('requestId', sql.Int, requestId)
      .input('toStatus', sql.NVarChar(20), toStatus)
      .query(`
        SELECT COUNT(*) AS total
        FROM dbo.RequestStatusHistory
        WHERE requestId = @requestId AND toStatus = @toStatus
      `);
    return result.recordset[0]?.total ?? 0;
  });
}

let cookie = '';

function extractCookie(response) {
  const raw = response.headers.getSetCookie?.() ?? [];
  for (const line of raw) {
    const match = new RegExp(`^${COOKIE_NAME}=([^;]+)`).exec(line);
    if (match) cookie = `${COOKIE_NAME}=${match[1]}`;
  }
  const single = response.headers.get('set-cookie');
  if (single && !cookie) {
    const match = new RegExp(`${COOKIE_NAME}=([^;]+)`).exec(single);
    if (match) cookie = `${COOKIE_NAME}=${match[1]}`;
  }
}

async function api(path, options = {}) {
  const headers = new Headers(options.headers);
  if (cookie) headers.set('Cookie', cookie);
  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${BASE}${path}`, { ...options, headers });
  extractCookie(response);

  const text = await response.text();
  let data = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }
  }

  if (!response.ok) {
    const message = data.error?.message ?? data.message ?? response.statusText;
    const err = new Error(`${options.method ?? 'GET'} ${path} → ${response.status}: ${message}`);
    err.status = response.status;
    err.data = data;
    throw err;
  }

  return data;
}

async function apiExpectFail(path, options, expectedStatus) {
  const headers = new Headers(options.headers);
  if (cookie) headers.set('Cookie', cookie);
  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${BASE}${path}`, { ...options, headers });
  extractCookie(response);
  const text = await response.text();
  let data = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }
  }

  if (response.status !== expectedStatus) {
    const message = data.error?.message ?? response.statusText;
    throw new Error(
      `${options.method ?? 'GET'} ${path} → se esperaba ${expectedStatus}, recibido ${response.status}: ${message}`,
    );
  }
  return data;
}

async function login(email, password) {
  cookie = '';
  return api('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

async function ensureSession(email, passwords, syncPassword) {
  await clearLoginRateLimit(email);
  let lastError = null;
  for (const password of passwords) {
    try {
      const session = await login(email, password);
      if (session.mustChangePassword && password === DEFAULT_PASSWORD) {
        await api('/auth/change-password', {
          method: 'POST',
          body: JSON.stringify({
            currentPassword: DEFAULT_PASSWORD,
            newPassword: TEST_PASSWORD,
            confirmPassword: TEST_PASSWORD,
          }),
        });
        return login(email, TEST_PASSWORD);
      }
      return session;
    } catch (error) {
      lastError = error;
    }
  }

  if (syncPassword) {
    await ensureExistingUserLoginPassword(email, syncPassword);
    return login(email, syncPassword);
  }

  throw lastError ?? new Error(`No se pudo iniciar sesión como ${email}`);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForNotification(userId, requestId, type, attempts = 12) {
  for (let i = 0; i < attempts; i += 1) {
    const count = await countRequestNotifications(userId, requestId, type);
    if (count > 0) return count;
    await sleep(400);
  }
  return 0;
}

async function main() {
  console.log('[smoke-req] Iniciando E2E Solicitudes Internas…');
  console.log(`[smoke-req] API: ${BASE}`);

  console.log('[smoke-req] 1/16 — Verificar esquema y usuarios');
  await assertRequestsTableExists();

  const leader = await getUserByEmail(LEADER_EMAIL);
  assert(leader, `No existe ${LEADER_EMAIL} en BD`);
  assert(leader.isActive, `Usuario líder inactivo: ${LEADER_EMAIL}`);
  assert(
    leader.firstName.toLowerCase().includes('rafael') || leader.lastName.toLowerCase().includes('torres'),
    `Se esperaba Rafael Torres, recibido: ${leader.firstName} ${leader.lastName}`,
  );

  const collaborator = await getUserByEmail(COLLABORATOR_EMAIL);
  assert(collaborator, `No existe ${COLLABORATOR_EMAIL} en BD`);
  assert(collaborator.isActive, `Colaborador inactivo: ${COLLABORATOR_EMAIL}`);

  const targetArea = await getTargetAreaId();
  assert(targetArea, `No se encontró área destino (${TARGET_AREA_NAMES.join(' / ')})`);
  console.log(`       Área destino: ${targetArea.name} (id=${targetArea.id})`);

  await ensureAreaLeader(targetArea.id, leader.id);
  if (!leader.positionIsLeader) {
    console.warn('       ⚠ Activando isLeader en cargo de Rafael Torres para bandeja');
    await ensureTiLeaderPosition(leader.id);
  }

  console.log('[smoke-req] 2/16 — Sesión colaborador');
  const collabSession = await ensureSession(
    COLLABORATOR_EMAIL,
    [TEST_PASSWORD, DEFAULT_PASSWORD],
    TEST_PASSWORD,
  );
  assert(collabSession.user?.id, 'Sesión colaborador sin user.id');

  console.log('[smoke-req] 3/16 — Áreas destino disponibles');
  const areasRes = await api('/requests/target-areas');
  assert(Array.isArray(areasRes.items) && areasRes.items.length > 0, 'target-areas vacío');
  const areaOption = areasRes.items.find((a) => a.id === targetArea.id);
  assert(areaOption, 'El área TI no aparece en target-areas');

  console.log('[smoke-req] 4/16 — Crear solicitud (colaborador → TI)');
  const created = await api('/requests', {
    method: 'POST',
    body: JSON.stringify({
      targetAreaId: targetArea.id,
      title: SMOKE_TITLE,
      description: SMOKE_DESCRIPTION,
      priority: 'High',
      category: 'Smoke',
    }),
  });
  const request = created.item;
  assert(request?.id, 'create sin item.id');
  assert(request.code?.startsWith('SOL-'), `Código inválido: ${request.code}`);
  assert(request.status === 'SUBMITTED', `Estado inicial debe ser SUBMITTED, tiene ${request.status}`);
  assert(request.requesterId === collabSession.user.id, 'requesterId no coincide');
  console.log(`       Creada ${request.code} (id=${request.id})`);

  console.log('[smoke-req] 5/16 — Mis solicitudes incluye la nueva');
  const mine = await api('/requests/mine');
  assert(
    mine.items.some((r) => r.id === request.id),
    'La solicitud no aparece en /requests/mine',
  );

  console.log('[smoke-req] 6/16 — Colaborador no puede gestionar estados');
  await apiExpectFail(
    `/requests/${request.id}/status`,
    { method: 'PATCH', body: JSON.stringify({ status: 'RECEIVED' }) },
    403,
  );

  console.log('[smoke-req] 7/16 — Notificación al líder (REQUEST_CREATED)');
  const leaderNotif = await waitForNotification(leader.id, request.id, 'REQUEST_CREATED');
  assert(leaderNotif > 0, 'Rafael Torres no recibió notificación REQUEST_CREATED');

  console.log('[smoke-req] 8/16 — Sesión Rafael Torres (líder)');
  const leaderSession = await ensureSession(
    LEADER_EMAIL,
    [LEADER_PASSWORD, TEST_PASSWORD, DEFAULT_PASSWORD],
    LEADER_PASSWORD,
  );
  assert(
    leaderSession.user?.firstName?.toLowerCase().includes('rafael')
      || leaderSession.user?.lastName?.toLowerCase().includes('torres'),
    'Sesión líder no es Rafael Torres',
  );
  const ledIds = leaderSession.user?.ledAreaIds ?? [];
  assert(
    ledIds.includes(targetArea.id) || leaderSession.user?.position?.isLeader,
    `Rafael debe liderar área ${targetArea.id} o tener isLeader; ledAreaIds=${ledIds.join(',')}`,
  );

  console.log('[smoke-req] 9/16 — Bandeja del líder contiene solicitud SUBMITTED');
  const inbox = await api('/requests/inbox');
  assert(typeof inbox.submittedCount === 'number', 'inbox sin submittedCount');
  assert(inbox.submittedCount >= 1, 'submittedCount debe ser >= 1');
  const inboxRow = inbox.items.find((r) => r.id === request.id);
  assert(inboxRow, 'Solicitud no visible en bandeja del líder');
  assert(inboxRow.status === 'SUBMITTED', 'En bandeja debe seguir SUBMITTED');
  assert(inboxRow.requesterName?.length > 0, 'Bandeja sin nombre de solicitante');

  console.log('[smoke-req] 10/16 — Detalle con canManage para líder');
  const detailLeader = await api(`/requests/${request.id}`);
  assert(detailLeader.capabilities?.canManage === true, 'Líder debe tener canManage');
  assert(detailLeader.capabilities?.canClose === false, 'Líder no debe tener canClose aún');
  assert(detailLeader.history?.length >= 1, 'Historial vacío tras creación');

  console.log('[smoke-req] 11/16 — Flujo líder: RECEIVED → IN_PROGRESS → RESOLVED');
  let step = await api(`/requests/${request.id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'RECEIVED', comment: 'Recibida por smoke' }),
  });
  assert(step.item.status === 'RECEIVED', 'Estado RECEIVED falló');

  step = await api(`/requests/${request.id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'IN_PROGRESS', comment: 'En gestión smoke' }),
  });
  assert(step.item.status === 'IN_PROGRESS', 'Estado IN_PROGRESS falló');

  step = await api(`/requests/${request.id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'RESOLVED' }),
  });
  assert(step.item.status === 'RESOLVED', 'Estado RESOLVED falló');
  assert(step.item.resolvedAt, 'resolvedAt debe estar definido');
  assert(step.history.length >= 4, 'Historial debe tener al menos 4 entradas');

  console.log('[smoke-req] 12/16 — Notificaciones al solicitante por cambios');
  const notifReceived = await waitForNotification(
    collaborator.id,
    request.id,
    'REQUEST_RECEIVED',
  );
  const notifProgress = await waitForNotification(
    collaborator.id,
    request.id,
    'REQUEST_IN_PROGRESS',
  );
  const notifResolved = await waitForNotification(
    collaborator.id,
    request.id,
    'REQUEST_RESOLVED',
  );
  assert(notifReceived > 0, 'Sin notificación REQUEST_RECEIVED al colaborador');
  assert(notifProgress > 0, 'Sin notificación REQUEST_IN_PROGRESS al colaborador');
  assert(notifResolved > 0, 'Sin notificación REQUEST_RESOLVED al colaborador');

  console.log('[smoke-req] 13/16 — Líder no puede cerrar (solo solicitante)');
  await apiExpectFail(
    `/requests/${request.id}/status`,
    { method: 'PATCH', body: JSON.stringify({ status: 'CLOSED' }) },
    400,
  );

  console.log('[smoke-req] 14/16 — Colaborador cierra solicitud RESOLVED');
  await ensureSession(COLLABORATOR_EMAIL, [TEST_PASSWORD, DEFAULT_PASSWORD], TEST_PASSWORD);
  const detailCollab = await api(`/requests/${request.id}`);
  assert(detailCollab.capabilities?.canClose === true, 'Solicitante debe poder cerrar');
  const closed = await api(`/requests/${request.id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'CLOSED' }),
  });
  assert(closed.item.status === 'CLOSED', 'Estado CLOSED falló');
  assert(closed.item.closedAt, 'closedAt debe estar definido');

  console.log('[smoke-req] 15/16 — Líder recibe notificación de cierre');
  await ensureSession(LEADER_EMAIL, [LEADER_PASSWORD, TEST_PASSWORD], LEADER_PASSWORD);
  const closedNotif = await waitForNotification(leader.id, request.id, 'REQUEST_CLOSED');
  assert(closedNotif > 0, 'Rafael no recibió REQUEST_CLOSED');

  const inboxAfter = await api('/requests/inbox?status=CLOSED');
  assert(
    inboxAfter.items.some((r) => r.id === request.id),
    'Solicitud cerrada no listada en bandeja con filtro CLOSED',
  );

  console.log('[smoke-req] 16/16 — Flujo rechazo (segunda solicitud)');
  await ensureSession(COLLABORATOR_EMAIL, [TEST_PASSWORD], TEST_PASSWORD);
  const rejectCreate = await api('/requests', {
    method: 'POST',
    body: JSON.stringify({
      targetAreaId: targetArea.id,
      title: `${SMOKE_TITLE} rechazo`,
      description: 'Smoke rechazo',
      priority: 'Low',
    }),
  });
  const rejectReq = rejectCreate.item;
  await ensureSession(LEADER_EMAIL, [LEADER_PASSWORD, TEST_PASSWORD], LEADER_PASSWORD);
  const rejected = await api(`/requests/${rejectReq.id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({
      status: 'REJECTED',
      rejectionReason: 'Rechazo de prueba smoke',
      comment: 'No aplica',
    }),
  });
  assert(rejected.item.status === 'REJECTED', 'REJECTED falló');
  assert(rejected.item.rejectionReason?.includes('smoke'), 'rejectionReason no guardado');
  const histRejected = await countStatusHistory(rejectReq.id, 'REJECTED');
  assert(histRejected >= 1, 'Historial sin entrada REJECTED');

  console.log('[smoke-req] ✓ E2E Solicitudes Internas completado');
  console.log(`       Solicitud principal: ${request.code}`);
  console.log(`       Líder: ${leader.firstName} ${leader.lastName}`);
  console.log(`       Solicitante: ${collaborator.firstName} ${collaborator.lastName}`);
}

main().catch((error) => {
  console.error('[smoke-req] ✗', error.message);
  if (error.data) console.error(JSON.stringify(error.data, null, 2));
  process.exit(1);
});
