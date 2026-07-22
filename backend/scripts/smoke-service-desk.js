#!/usr/bin/env node
'use strict';

/**
 * Smoke E2E Service Desk: adjuntos, notificaciones TI y descarga.
 * Uso: node scripts/smoke-service-desk.js
 */

require('dotenv').config();

const bcrypt = require('bcrypt');
const sql = require('mssql');

const BASE = process.env.SMOKE_API_URL ?? 'http://localhost:3000/api/v1';
const COOKIE_NAME = process.env.AUTH_COOKIE_NAME ?? 'intranet_session';

const COLLABORATOR_EMAIL = process.env.SMOKE_COLLABORATOR_EMAIL ?? 'colaborador@yopmail.com';
const IT_AGENT_EMAIL = process.env.SMOKE_IT_EMAIL ?? 'agente.ti@yopmail.com';
const DEFAULT_PASSWORD = process.env.SEED_COLLABORATOR_PASSWORD?.trim()
  || process.env.SEED_ADMIN_PASSWORD?.trim()
  || 'ChangeMe123!';
const TEST_PASSWORD = process.env.SMOKE_TEST_PASSWORD ?? 'TestDocFlow2026!';

const SMOKE_TITLE = `Smoke ticket ${Date.now()}`;
const SMOKE_DESCRIPTION =
  'Ticket generado por smoke-service-desk.js para validar adjuntos y notificaciones TI.';

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

async function ensureItAgentUser() {
  const passwordHash = await bcrypt.hash(TEST_PASSWORD, 12);
  await withPool(async (pool) => {
    await pool
      .request()
      .input('email', sql.NVarChar(255), IT_AGENT_EMAIL)
      .input('passwordHash', sql.NVarChar(255), passwordHash)
      .query(`
        DECLARE @areaId INT = (
          SELECT TOP 1 id FROM dbo.Areas
          WHERE name IN (N'Infraestructura Tecnológica', N'TI') AND isActive = 1
          ORDER BY CASE WHEN name = N'Infraestructura Tecnológica' THEN 0 ELSE 1 END
        );
        DECLARE @roleId INT = (SELECT TOP 1 id FROM dbo.Roles WHERE name = N'colaborador' AND isActive = 1);
        DECLARE @positionId INT;

        IF @areaId IS NULL OR @roleId IS NULL
          THROW 50001, 'Área TI o rol colaborador no encontrados', 1;

        IF NOT EXISTS (
          SELECT 1 FROM dbo.Positions WHERE name = N'Agente TI Smoke' AND areaId = @areaId
        )
        BEGIN
          INSERT INTO dbo.Positions (name, areaId, isActive, isLeader)
          VALUES (N'Agente TI Smoke', @areaId, 1, 0);
        END
        ELSE
        BEGIN
          UPDATE dbo.Positions SET isActive = 1 WHERE name = N'Agente TI Smoke' AND areaId = @areaId;
        END;

        SET @positionId = (
          SELECT TOP 1 id FROM dbo.Positions
          WHERE name = N'Agente TI Smoke' AND areaId = @areaId
        );

        IF NOT EXISTS (SELECT 1 FROM dbo.Users WHERE email = @email)
        BEGIN
          INSERT INTO dbo.Users (
            firstName, lastName, email, passwordHash,
            roleId, areaId, positionId,
            isActive, mustChangePassword, createdBy
          )
          VALUES (
            N'Agente', N'TI Smoke', @email, @passwordHash,
            @roleId, @areaId, @positionId,
            1, 0, NULL
          );
        END
        ELSE
        BEGIN
          UPDATE dbo.Users
          SET passwordHash = @passwordHash,
              areaId = @areaId,
              positionId = @positionId,
              isActive = 1,
              mustChangePassword = 0,
              updatedAt = SYSUTCDATETIME()
          WHERE email = @email;
        END
      `);
  });
}

async function getUserIdByEmail(email) {
  return withPool(async (pool) => {
    const result = await pool
      .request()
      .input('email', sql.NVarChar(255), email)
      .query(`SELECT TOP 1 id FROM dbo.Users WHERE email = @email AND isActive = 1`);
    return result.recordset[0]?.id ?? null;
  });
}

async function countTicketNotifications(userId, ticketId) {
  return withPool(async (pool) => {
    const result = await pool
      .request()
      .input('userId', sql.Int, userId)
      .input('ticketId', sql.Int, ticketId)
      .query(`
        SELECT COUNT(*) AS total
        FROM dbo.Notifications
        WHERE userId = @userId
          AND type = N'TICKET_CREATED'
          AND resourceType = N'ticket'
          AND resourceId = @ticketId
      `);
    return result.recordset[0]?.total ?? 0;
  });
}

async function countTicketAttachments(ticketId) {
  return withPool(async (pool) => {
    const result = await pool
      .request()
      .input('ticketId', sql.Int, ticketId)
      .query(`
        SELECT COUNT(*) AS total FROM dbo.TicketAttachments WHERE ticketId = @ticketId
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

async function ensureCollaboratorSession() {
  let session = await login(COLLABORATOR_EMAIL, DEFAULT_PASSWORD).catch(() => null);
  if (!session) {
    return login(COLLABORATOR_EMAIL, TEST_PASSWORD);
  }
  if (session.mustChangePassword) {
    await api('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({
        currentPassword: DEFAULT_PASSWORD,
        newPassword: TEST_PASSWORD,
        confirmPassword: TEST_PASSWORD,
      }),
    });
    return login(COLLABORATOR_EMAIL, TEST_PASSWORD);
  }
  return session;
}

async function ensureItAgentSession() {
  let session = await login(IT_AGENT_EMAIL, TEST_PASSWORD).catch(() => null);
  if (session) return session;
  return login(IT_AGENT_EMAIL, DEFAULT_PASSWORD);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function makePngBlob() {
  return new Blob([PNG_1X1], { type: 'image/png' });
}

function buildTicketFormData({ title, description, categoryId, priority, files = [] }) {
  const form = new FormData();
  form.append('title', title);
  form.append('description', description);
  form.append('categoryId', String(categoryId));
  form.append('priority', priority);
  for (const file of files) {
    form.append('files', file.blob, file.name);
  }
  return form;
}

async function waitForNotification(userId, ticketId, attempts = 10) {
  for (let i = 0; i < attempts; i += 1) {
    const count = await countTicketNotifications(userId, ticketId);
    if (count > 0) return count;
    await sleep(500);
  }
  return 0;
}

async function main() {
  console.log('[smoke-sd] Iniciando flujo Service Desk E2E…');
  console.log(`[smoke-sd] API: ${BASE}`);

  const smtpConfigured = Boolean(
    process.env.SMTP_HOST?.trim() && process.env.SMTP_USER?.trim(),
  );
  if (!smtpConfigured) {
    console.warn(
      '[smoke-sd] SMTP no configurado: se validará API y BD; correos solo en consola del servidor',
    );
  }

  console.log('[smoke-sd] 1/10 — Preparar agente TI');
  await ensureItAgentUser();
  const itUserId = await getUserIdByEmail(IT_AGENT_EMAIL);
  assert(itUserId, `Usuario TI ${IT_AGENT_EMAIL} no encontrado`);
  console.log(`       Agente TI: ${IT_AGENT_EMAIL} (id=${itUserId})`);

  console.log('[smoke-sd] 2/10 — Sesión colaborador y categoría activa');
  await ensureCollaboratorSession();
  const categories = await api('/ticket-categories?isActive=true');
  assert(categories.items?.length > 0, 'Debe existir al menos una categoría TI activa');
  const categoryId = categories.items[0].id;
  console.log(`       Categoría: ${categories.items[0].name} (id=${categoryId})`);

  console.log('[smoke-sd] 3/10 — Rechazar adjunto con tipo no permitido');
  const invalidForm = buildTicketFormData({
    title: `${SMOKE_TITLE} (inválido)`,
    description: SMOKE_DESCRIPTION,
    categoryId,
    priority: 'Medium',
    files: [{ blob: new Blob(['texto plano'], { type: 'text/plain' }), name: 'nota.txt' }],
  });
  await apiExpectFail('/tickets', { method: 'POST', body: invalidForm }, 400);
  console.log('       400 para .txt ✓');

  console.log('[smoke-sd] 4/10 — Crear ticket sin adjuntos (JSON)');
  const plain = await api('/tickets', {
    method: 'POST',
    body: JSON.stringify({
      title: `${SMOKE_TITLE} — sin adjuntos`,
      description: SMOKE_DESCRIPTION,
      categoryId,
      priority: 'Low',
    }),
  });
  assert(plain.item?.id, 'Ticket sin adjuntos no creado');
  console.log(`       Ticket ${plain.item.code} ✓`);

  console.log('[smoke-sd] 5/10 — Crear ticket con 2 adjuntos PNG');
  const withFilesForm = buildTicketFormData({
    title: SMOKE_TITLE,
    description: SMOKE_DESCRIPTION,
    categoryId,
    priority: 'High',
    files: [
      { blob: makePngBlob(), name: 'captura-smoke-1.png' },
      { blob: makePngBlob(), name: 'captura-smoke-2.png' },
    ],
  });
  const created = await api('/tickets', { method: 'POST', body: withFilesForm });
  const ticket = created.item;
  assert(ticket?.id, 'Ticket con adjuntos no creado');
  assert(ticket.code, 'Ticket sin código');
  console.log(`       Ticket ${ticket.code} (id=${ticket.id}) ✓`);

  console.log('[smoke-sd] 6/10 — Verificar adjuntos en detalle y BD');
  const detail = await api(`/tickets/${ticket.id}`);
  assert(Array.isArray(detail.attachments), 'Respuesta sin arreglo attachments');
  assert(detail.attachments.length === 2, `Se esperaban 2 adjuntos, hay ${detail.attachments.length}`);
  const dbAttachments = await countTicketAttachments(ticket.id);
  assert(dbAttachments === 2, `BD: se esperaban 2 adjuntos, hay ${dbAttachments}`);
  console.log('       2 adjuntos en API y BD ✓');

  console.log('[smoke-sd] 7/10 — Descargar primer adjunto vía API');
  const attachmentId = detail.attachments[0].id;
  const fileResponse = await fetch(
    `${BASE}/tickets/${ticket.id}/attachments/${attachmentId}/download`,
    { headers: cookie ? { Cookie: cookie } : {} },
  );
  assert(fileResponse.ok, `Descarga API falló: ${fileResponse.status}`);
  const downloaded = Buffer.from(await fileResponse.arrayBuffer());
  assert(downloaded.length > 0, 'Archivo descargado vacío');
  const contentType = fileResponse.headers.get('content-type') ?? '';
  assert(contentType.startsWith('image/'), `Content-Type inesperado: ${contentType}`);
  console.log(`       Descarga OK (${downloaded.length} bytes, ${contentType}) ✓`);

  console.log('[smoke-sd] 8/10 — Colaborador ve solo sus tickets (mineOnly)');
  const mine = await api('/tickets?mineOnly=1');
  const inMine = (mine.items ?? []).some((t) => t.id === ticket.id);
  assert(inMine, 'Ticket no aparece en mis solicitudes del colaborador');
  console.log('       Visible en mis solicitudes ✓');

  console.log('[smoke-sd] 9/10 — Agente TI: capacidades, listado y notificación');
  await ensureItAgentSession();
  const caps = await api('/tickets/capabilities');
  assert(caps.canManageDesk === true, 'Agente TI debe poder gestionar mesa de ayuda');
  assert(caps.isItAgent === true, 'Agente TI debe tener isItAgent=true');

  const allTickets = await api('/tickets');
  const inDesk = (allTickets.items ?? []).some((t) => t.id === ticket.id);
  assert(inDesk, 'Agente TI debe ver el ticket en el listado general');

  const notifications = await api('/notifications');
  const inApp = (notifications.items ?? []).some(
    (n) => n.type === 'TICKET_CREATED' && n.resourceType === 'ticket' && n.resourceId === ticket.id,
  );
  if (!inApp) {
    await sleep(1500);
  }
  const notificationsRetry = inApp ? { items: notifications.items } : await api('/notifications');
  const inAppFinal = (notificationsRetry.items ?? []).some(
    (n) => n.type === 'TICKET_CREATED' && n.resourceType === 'ticket' && n.resourceId === ticket.id,
  );
  assert(inAppFinal, 'Agente TI debe tener notificación TICKET_CREATED in-app');

  const notifDb = await waitForNotification(itUserId, ticket.id);
  assert(notifDb > 0, 'Debe existir notificación TICKET_CREATED en BD para el agente TI');
  console.log('       Mesa TI, listado y notificación in-app ✓');

  if (smtpConfigured) {
    console.log('[smoke-sd] 10/10 — Esperar envío de correo TI (3s)');
    await sleep(3000);
    console.log('       Revise logs del servidor: [email] Nuevo ticket…');
  } else {
    console.log('[smoke-sd] 10/10 — Omitido (sin SMTP); adjuntos y notificaciones ya validados');
  }

  console.log('\n✅ Smoke test Service Desk: OK');
}

main().catch((err) => {
  console.error('\n❌ Smoke test Service Desk: FALLÓ');
  console.error(err.message);
  if (err.data) console.error(JSON.stringify(err.data, null, 2));
  process.exit(1);
});
