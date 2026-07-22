#!/usr/bin/env node
'use strict';

/**
 * Smoke E2E Actividades / Kanban TI:
 * - Líder: Rafael Torres (soyrafaeltorres.la@gmail.com)
 * - Agente TI: agente.ti@yopmail.com
 *
 * No crea usuarios; usa cuentas existentes en BD.
 * Uso: npm run smoke:activities
 */

require('dotenv').config();

const bcrypt = require('bcrypt');
const sql = require('mssql');

const BASE = process.env.SMOKE_API_URL ?? 'http://localhost:3000/api/v1';
const COOKIE_NAME = process.env.AUTH_COOKIE_NAME ?? 'intranet_session';

const IT_AGENT_EMAIL = process.env.SMOKE_IT_EMAIL ?? 'agente.ti@yopmail.com';
const IT_LEADER_EMAIL = process.env.SMOKE_IT_LEADER_EMAIL ?? 'soyrafaeltorres.la@gmail.com';

const DEFAULT_PASSWORD = process.env.SEED_COLLABORATOR_PASSWORD?.trim()
  || process.env.SEED_ADMIN_PASSWORD?.trim()
  || 'ChangeMe123!';
const TEST_PASSWORD = process.env.SMOKE_TEST_PASSWORD ?? 'TestDocFlow2026!';
const IT_AGENT_PASSWORD = process.env.SMOKE_IT_PASSWORD?.trim() || TEST_PASSWORD;
const IT_LEADER_PASSWORD = process.env.SMOKE_IT_LEADER_PASSWORD?.trim() || TEST_PASSWORD;

const IT_AREA_NAMES = ['Infraestructura Tecnológica', 'TI'];
const SMOKE_TASK_TITLE = `Smoke Kanban TI ${Date.now()}`;

/** PNG 1×1 px válido */
const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

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
      throw new Error(`No se encontró usuario existente para sincronizar contraseña: ${email}`);
    }
  });
}

async function ensureTiLeaderRole(userId) {
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

async function getBoardIdForArea(areaId) {
  return withPool(async (pool) => {
    const result = await pool
      .request()
      .input('areaId', sql.Int, areaId)
      .query(`SELECT TOP 1 id FROM dbo.Boards WHERE areaId = @areaId`);
    return result.recordset[0]?.id ?? null;
  });
}

async function countTaskNotifications(userId, taskId, type) {
  return withPool(async (pool) => {
    const result = await pool
      .request()
      .input('userId', sql.Int, userId)
      .input('taskId', sql.Int, taskId)
      .input('type', sql.NVarChar(40), type)
      .query(`
        SELECT COUNT(*) AS total
        FROM dbo.Notifications
        WHERE userId = @userId
          AND type = @type
          AND resourceType = N'task'
          AND resourceId = @taskId
      `);
    return result.recordset[0]?.total ?? 0;
  });
}

async function countTaskActivity(taskId, action) {
  return withPool(async (pool) => {
    const result = await pool
      .request()
      .input('taskId', sql.Int, taskId)
      .input('action', sql.NVarChar(30), action)
      .query(`
        SELECT COUNT(*) AS total
        FROM dbo.TaskActivityLog
        WHERE taskId = @taskId AND action = @action
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
  if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
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
  if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
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

function isItArea(areaName) {
  const normalized = (areaName ?? '').trim().toLowerCase();
  return IT_AREA_NAMES.some((name) => name.toLowerCase() === normalized);
}

function findColumn(columns, namePart) {
  return columns.find((c) => c.name.toLowerCase().includes(namePart.toLowerCase()));
}

async function main() {
  console.log('[smoke-act] Iniciando flujo Actividades / Kanban E2E…');
  console.log(`[smoke-act] API: ${BASE}`);

  console.log('[smoke-act] 1/14 — Verificar usuarios existentes (sin crear cuentas)');
  const leader = await getUserByEmail(IT_LEADER_EMAIL);
  assert(leader, `No existe el líder TI ${IT_LEADER_EMAIL} en BD`);
  assert(leader.isActive, `El líder ${IT_LEADER_EMAIL} está inactivo`);
  assert(isItArea(leader.areaName), `El líder debe estar en área TI, tiene: ${leader.areaName}`);
  assert(
    leader.firstName.toLowerCase().includes('rafael') || leader.lastName.toLowerCase().includes('torres'),
    `Se esperaba Rafael Torres, recibido: ${leader.firstName} ${leader.lastName}`,
  );
  if (!leader.positionIsLeader) {
    console.warn(
      `       ⚠ Cargo sin isLeader en BD; se activará isLeader para pruebas de Rafael Torres`,
    );
    await ensureTiLeaderRole(leader.id);
    leader.positionIsLeader = true;
  }

  const agent = await getUserByEmail(IT_AGENT_EMAIL);
  assert(agent, `No existe el agente TI ${IT_AGENT_EMAIL} en BD`);
  assert(agent.isActive, `El agente ${IT_AGENT_EMAIL} está inactivo`);
  assert(isItArea(agent.areaName), `El agente debe estar en área TI, tiene: ${agent.areaName}`);
  assert(agent.id !== leader.id, 'Líder y agente deben ser usuarios distintos');

  const boardId = await getBoardIdForArea(leader.areaId);
  assert(boardId, `No hay tablero Kanban para el área ${leader.areaName} (id=${leader.areaId})`);

  console.log(`       Líder: ${leader.firstName} ${leader.lastName} (${leader.email})`);
  console.log(`       Agente TI: ${agent.firstName} ${agent.lastName} (${agent.email})`);
  console.log(`       Tablero TI id=${boardId}`);

  if (process.env.SMOKE_SYNC_PASSWORDS !== '0') {
    console.log('[smoke-act] 1b/14 — Sincronizar contraseñas de cuentas existentes (sin crear usuarios)');
    await clearLoginRateLimit(IT_LEADER_EMAIL);
    await ensureExistingUserLoginPassword(IT_LEADER_EMAIL, IT_LEADER_PASSWORD);
    console.log(`       Contraseña de prueba aplicada a ${IT_LEADER_EMAIL}`);
  }

  console.log('[smoke-act] 2/14 — Sesión líder TI');
  await clearLoginRateLimit(IT_LEADER_EMAIL);
  const leaderSession = await ensureSession(
    IT_LEADER_EMAIL,
    [IT_LEADER_PASSWORD],
    null,
  );
  assert(leaderSession.user?.id === leader.id, 'Sesión líder no coincide con BD');
  console.log(`       Login OK (${leaderSession.user.email})`);

  console.log('[smoke-act] 3/14 — Listar tableros del líder');
  const myBoards = await api('/boards/my');
  assert(Array.isArray(myBoards.items), 'Respuesta /boards/my sin items');
  const tiBoard = myBoards.items.find((b) => b.id === boardId);
  assert(tiBoard, 'El líder debe ver el tablero de su área TI');
  console.log(`       Tablero visible: ${tiBoard.name} ✓`);

  console.log('[smoke-act] 4/14 — Detalle del tablero con columnas');
  const boardDetail = await api(`/boards/${boardId}`);
  assert(boardDetail.columns?.length >= 4, 'El tablero debe tener columnas por defecto');
  assert(boardDetail.capabilities?.canManage === true, 'Rafael Torres debe poder gestionar el tablero TI');
  assert(boardDetail.capabilities?.canViewMetrics === true, 'Rafael Torres debe ver métricas del tablero');

  const todoColumn = findColumn(boardDetail.columns, 'por hacer') ?? boardDetail.columns[0];
  const progressColumn =
    findColumn(boardDetail.columns, 'progreso') ?? boardDetail.columns[1] ?? todoColumn;
  assert(todoColumn?.id, 'Columna inicial no encontrada');
  console.log(`       Columnas: ${boardDetail.columns.map((c) => c.name).join(', ')} ✓`);

  console.log('[smoke-act] 5/14 — Líder crea tarea y asigna al agente TI');
  const created = await api('/tasks', {
    method: 'POST',
    body: JSON.stringify({
      boardId,
      columnId: todoColumn.id,
      title: SMOKE_TASK_TITLE,
      description: 'Tarea generada por smoke-activities.js',
      priority: 'High',
      color: '#0369a1',
      assigneeIds: [agent.id],
    }),
  });
  const task = created.item;
  assert(task?.id, 'Tarea no creada');
  assert(task.assignees?.some((a) => a.userId === agent.id), 'El agente debe estar asignado');
  console.log(`       Tarea #${task.id} "${task.title}" ✓`);

  console.log('[smoke-act] 6/14 — Log de actividad CREATED');
  const createdLog = await countTaskActivity(task.id, 'CREATED');
  assert(createdLog >= 1, 'Debe existir actividad CREATED en BD');
  console.log('       TaskActivityLog CREATED ✓');

  console.log('[smoke-act] 7/14 — Agente TI: login, tablero y notificación de asignación');
  await clearLoginRateLimit(IT_AGENT_EMAIL);
  await ensureSession(IT_AGENT_EMAIL, [IT_AGENT_PASSWORD], null);

  const agentBoards = await api('/boards/my');
  const agentSeesBoard = (agentBoards.items ?? []).some((b) => b.id === boardId);
  assert(agentSeesBoard, 'El agente TI debe ver el tablero de su área');

  await sleep(800);
  const agentNotifications = await api('/notifications');
  const assignedInApp = (agentNotifications.items ?? []).some(
    (n) => n.type === 'TASK_ASSIGNED' && n.resourceType === 'task' && n.resourceId === task.id,
  );
  const assignedDb = await countTaskNotifications(agent.id, task.id, 'TASK_ASSIGNED');
  assert(assignedInApp || assignedDb > 0, 'El agente debe recibir notificación TASK_ASSIGNED');
  console.log('       Tablero visible y notificación de asignación ✓');

  console.log('[smoke-act] 8/14 — Agente comenta en la tarea');
  const comment = await api(`/tasks/${task.id}/comments`, {
    method: 'POST',
    body: JSON.stringify({ message: 'Comentario smoke desde agente TI' }),
  });
  assert(comment.item?.id, 'Comentario no creado');
  const commentedLog = await countTaskActivity(task.id, 'COMMENTED');
  assert(commentedLog >= 1, 'Debe existir actividad COMMENTED');
  console.log('       Comentario y log COMMENTED ✓');

  console.log('[smoke-act] 9/14 — Agente mueve tarea asignada a En Progreso');
  await api(`/tasks/${task.id}/move`, {
    method: 'PATCH',
    body: JSON.stringify({
      columnId: progressColumn.id,
      order: 0,
    }),
  });
  const afterMove = await api(`/tasks/${task.id}`);
  assert(afterMove.item.columnId === progressColumn.id, 'La tarea no cambió de columna');
  assert(afterMove.item.status === 'IN_PROGRESS', `Status esperado IN_PROGRESS, recibido ${afterMove.item.status}`);
  const movedLog = await countTaskActivity(task.id, 'MOVED');
  assert(movedLog >= 1, 'Debe existir actividad MOVED');
  console.log('       Movimiento a En Progreso ✓');

  console.log('[smoke-act] 10/14 — Agente no puede ver métricas del tablero');
  await apiExpectFail(`/boards/${boardId}/metrics`, { method: 'GET' }, 403);
  console.log('       403 métricas para colaborador ✓');

  console.log('[smoke-act] 11/14 — Agente no puede mover tarea ajena sin asignación');
  await clearLoginRateLimit(IT_LEADER_EMAIL);
  await ensureSession(IT_LEADER_EMAIL, [IT_LEADER_PASSWORD], null);
  const unassigned = await api('/tasks', {
    method: 'POST',
    body: JSON.stringify({
      boardId,
      columnId: todoColumn.id,
      title: `${SMOKE_TASK_TITLE} — sin asignar`,
      description: 'Tarea solo del líder para probar permisos de movimiento',
      priority: 'Low',
      assigneeIds: [],
    }),
  });
  const otherTask = unassigned.item;
  assert(otherTask?.id, 'Tarea sin asignar no creada');

  await clearLoginRateLimit(IT_AGENT_EMAIL);
  await ensureSession(IT_AGENT_EMAIL, [IT_AGENT_PASSWORD], null);
  await apiExpectFail(
    `/tasks/${otherTask.id}/move`,
    {
      method: 'PATCH',
      body: JSON.stringify({ columnId: progressColumn.id, order: 0 }),
    },
    403,
  );
  console.log('       403 al mover tarea ajena ✓');

  console.log('[smoke-act] 12/14 — Agente sube adjunto PNG a su tarea asignada');
  const form = new FormData();
  form.append('file', new Blob([PNG_1X1], { type: 'image/png' }), 'smoke-kanban.png');
  const attachmentRes = await api(`/tasks/${task.id}/attachments`, { method: 'POST', body: form });
  assert(attachmentRes.item?.id, 'Adjunto no registrado');
  const attachmentLog = await countTaskActivity(task.id, 'ATTACHMENT_ADDED');
  assert(attachmentLog >= 1, 'Debe existir actividad ATTACHMENT_ADDED');

  const downloadRes = await fetch(
    `${BASE}/tasks/${task.id}/attachments/${attachmentRes.item.id}/download`,
    { headers: cookie ? { Cookie: cookie } : {} },
  );
  assert(downloadRes.ok, `Descarga adjunto falló: ${downloadRes.status}`);
  const downloaded = Buffer.from(await downloadRes.arrayBuffer());
  assert(downloaded.length > 0, 'Adjunto descargado vacío');
  console.log(`       Adjunto subido y descargado (${downloaded.length} bytes) ✓`);

  console.log('[smoke-act] 13/14 — Líder consulta métricas del tablero TI');
  await clearLoginRateLimit(IT_LEADER_EMAIL);
  await ensureSession(IT_LEADER_EMAIL, [IT_LEADER_PASSWORD], null);
  const metrics = await api(`/boards/${boardId}/metrics`);
  assert(metrics.summary != null, 'Métricas sin resumen');
  assert(Array.isArray(metrics.byColumn), 'Métricas sin desglose por columna');
  assert(Array.isArray(metrics.byAssignee), 'Métricas sin desglose por colaborador');
  console.log(
    `       Métricas: total=${metrics.summary.totalTasks}, en progreso=${metrics.summary.inProgress} ✓`,
  );

  console.log('[smoke-act] 14/14 — Líder archiva tarea de smoke');
  await api(`/tasks/${task.id}/archive`, { method: 'PATCH' });
  const archived = await api(`/tasks/${task.id}`);
  assert(archived.item.archivedAt, 'La tarea no quedó archivada');
  assert(archived.item.status === 'ARCHIVED', 'Status esperado ARCHIVED');
  const archivedLog = await countTaskActivity(task.id, 'ARCHIVED');
  assert(archivedLog >= 1, 'Debe existir actividad ARCHIVED');
  console.log('       Archivo de tarea ✓');

  console.log('\n✅ Smoke test Actividades / Kanban TI: OK');
}

main().catch((err) => {
  console.error('\n❌ Smoke test Actividades / Kanban TI: FALLÓ');
  console.error(err.message);
  if (err.data) console.error(JSON.stringify(err.data, null, 2));
  process.exit(1);
});
