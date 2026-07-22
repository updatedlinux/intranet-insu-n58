#!/usr/bin/env node
'use strict';

/**
 * Smoke E2E de comunicados: permisos por área, creación, publicación y notificación por correo.
 * Uso: node scripts/smoke-announcements.js
 */

require('dotenv').config();

const bcrypt = require('bcrypt');
const sql = require('mssql');

const BASE = process.env.SMOKE_API_URL ?? 'http://localhost:3000/api/v1';
const COOKIE_NAME = process.env.AUTH_COOKIE_NAME ?? 'intranet_session';

const COLLABORATOR_EMAIL = process.env.SMOKE_COLLABORATOR_EMAIL ?? 'colaborador@yopmail.com';
const MANAGER_EMAIL = process.env.SMOKE_MANAGER_EMAIL ?? 'gerente.operaciones@yopmail.com';
const ADMIN_EMAIL = process.env.SMOKE_ADMIN_EMAIL ?? 'admin@yopmail.com';
const DEFAULT_PASSWORD = process.env.SEED_COLLABORATOR_PASSWORD?.trim()
  || process.env.SEED_ADMIN_PASSWORD?.trim()
  || 'ChangeMe123!';
const TEST_PASSWORD = process.env.SMOKE_TEST_PASSWORD ?? 'TestDocFlow2026!';

const SMOKE_TITLE = `Smoke comunicado ${Date.now()}`;
const SMOKE_SUMMARY =
  'Resumen de prueba E2E para validar creación, publicación y envío de notificaciones.';
const SMOKE_CONTENT = '<p>Contenido generado por smoke-announcements.js</p>';

async function resetUserPassword(email) {
  const passwordHash = await bcrypt.hash(TEST_PASSWORD, 12);
  const pool = await sql.connect({
    server: process.env.DB_SERVER,
    port: Number(process.env.DB_PORT ?? 1433),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    options: {
      encrypt: process.env.DB_ENCRYPT === 'true',
      trustServerCertificate: process.env.DB_ENCRYPT !== 'true',
    },
  });

  await pool
    .request()
    .input('email', sql.NVarChar(255), email)
    .input('passwordHash', sql.NVarChar(255), passwordHash)
    .query(`
      UPDATE dbo.Users
      SET passwordHash = @passwordHash,
          mustChangePassword = 0,
          isActive = 1,
          updatedAt = SYSUTCDATETIME()
      WHERE email = @email
         OR email = REPLACE(@email, N'@yopmail.com', N'@insular.com');
    `);

  await pool.close();
}

async function ensureGerenteUser() {
  const passwordHash = await bcrypt.hash(TEST_PASSWORD, 12);
  const pool = await sql.connect({
    server: process.env.DB_SERVER,
    port: Number(process.env.DB_PORT ?? 1433),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    options: {
      encrypt: process.env.DB_ENCRYPT === 'true',
      trustServerCertificate: process.env.DB_ENCRYPT !== 'true',
    },
  });

  await pool
    .request()
    .input('email', sql.NVarChar(255), MANAGER_EMAIL)
    .input('passwordHash', sql.NVarChar(255), passwordHash)
    .query(`
      DECLARE @areaId INT = (SELECT TOP 1 id FROM dbo.Areas WHERE name = N'Operaciones' AND isActive = 1);
      DECLARE @roleId INT = (SELECT TOP 1 id FROM dbo.Roles WHERE name = N'colaborador' AND isActive = 1);
      DECLARE @positionId INT;

      IF @areaId IS NULL OR @roleId IS NULL
        THROW 50001, 'Área Operaciones o rol colaborador no encontrados', 1;

      IF NOT EXISTS (
        SELECT 1 FROM dbo.Positions WHERE name = N'Gerente Operaciones' AND areaId = @areaId
      )
      BEGIN
        INSERT INTO dbo.Positions (name, areaId, isActive, isLeader)
        VALUES (N'Gerente Operaciones', @areaId, 1, 1);
      END
      ELSE
      BEGIN
        UPDATE dbo.Positions SET isLeader = 1, isActive = 1
        WHERE name = N'Gerente Operaciones' AND areaId = @areaId;
      END;

      SET @positionId = (
        SELECT TOP 1 id FROM dbo.Positions
        WHERE name = N'Gerente Operaciones' AND areaId = @areaId
      );

      IF NOT EXISTS (SELECT 1 FROM dbo.Users WHERE email = @email)
      BEGIN
        INSERT INTO dbo.Users (
          firstName, lastName, email, passwordHash,
          roleId, areaId, positionId,
          isActive, mustChangePassword, createdBy
        )
        VALUES (
          N'Gerente', N'Operaciones', @email, @passwordHash,
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

  await pool.close();
}

async function countRecipients(targetAreaId) {
  const pool = await sql.connect({
    server: process.env.DB_SERVER,
    port: Number(process.env.DB_PORT ?? 1433),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    options: {
      encrypt: process.env.DB_ENCRYPT === 'true',
      trustServerCertificate: process.env.DB_ENCRYPT !== 'true',
    },
  });

  const request = pool.request();
  let query;
  if (targetAreaId == null) {
    query = `
      SELECT COUNT(*) AS total
      FROM dbo.Users u
      WHERE u.isActive = 1
    `;
  } else {
    request.input('areaId', sql.Int, targetAreaId);
    query = `
      SELECT COUNT(*) AS total
      FROM dbo.Users u
      WHERE u.isActive = 1 AND u.areaId = @areaId
    `;
  }

  const result = await request.query(query);
  await pool.close();
  return result.recordset[0]?.total ?? 0;
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

async function ensureManagerSession() {
  let session = await login(MANAGER_EMAIL, TEST_PASSWORD).catch(() => null);
  if (session) return session;
  return login(MANAGER_EMAIL, DEFAULT_PASSWORD);
}

async function ensureAdminSession() {
  let session = await login(ADMIN_EMAIL, TEST_PASSWORD).catch(() => null);
  if (session) return session;

  session = await login(ADMIN_EMAIL, DEFAULT_PASSWORD).catch(() => null);
  if (session?.mustChangePassword) {
    await api('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({
        currentPassword: DEFAULT_PASSWORD,
        newPassword: TEST_PASSWORD,
        confirmPassword: TEST_PASSWORD,
      }),
    });
    return login(ADMIN_EMAIL, TEST_PASSWORD);
  }
  if (session) return session;

  await resetUserPassword(ADMIN_EMAIL);
  return login(ADMIN_EMAIL, TEST_PASSWORD);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  console.log('[smoke] Iniciando flujo de comunicados E2E…');
  console.log(`[smoke] API: ${BASE}`);

  const smtpConfigured = Boolean(
    process.env.SMTP_HOST?.trim() && process.env.SMTP_USER?.trim(),
  );
  if (!smtpConfigured) {
    console.warn('[smoke] SMTP no configurado: se validará API; correos solo se registrarán en consola del servidor');
  }

  console.log('[smoke] 0/8 — Preparar gerente de Operaciones');
  await ensureGerenteUser();

  console.log('[smoke] 1/8 — Capacidades del gerente');
  const managerSession = await ensureManagerSession();
  const managerCaps = await api('/announcements/capabilities');
  assert(managerCaps.canManage === true, 'Gerente debe poder gestionar comunicados');
  assert(managerCaps.canPublishCompanyWide === false, 'Gerente Operaciones no debe publicar a toda la empresa');
  assert(
    Array.isArray(managerCaps.publishableAreaIds) && managerCaps.publishableAreaIds.length >= 1,
    'Debe tener áreas publicables',
  );
  const operacionesAreaId = managerSession.user.area?.id;
  assert(operacionesAreaId, 'Gerente sin área asignada');
  assert(
    managerCaps.publishableAreaIds.includes(operacionesAreaId),
    'Operaciones debe estar en áreas publicables del gerente',
  );
  console.log(`       Gerente: ${managerSession.user.email} · áreas publicables: ${managerCaps.publishableAreaIds.join(', ')}`);

  console.log('[smoke] 2/8 — Gerente no puede crear comunicado empresa completa');
  await apiExpectFail(
    '/announcements',
    {
      method: 'POST',
      body: JSON.stringify({
        title: `${SMOKE_TITLE} (rechazado)`,
        summary: SMOKE_SUMMARY,
        content: SMOKE_CONTENT,
        category: 'NOTICIA',
        targetAreaId: null,
        publish: false,
      }),
    },
    403,
  );
  console.log('       403 al intentar targetAreaId=null ✓');

  console.log('[smoke] 3/8 — Crear y publicar comunicado para Operaciones');
  const created = await api('/announcements', {
    method: 'POST',
    body: JSON.stringify({
      title: SMOKE_TITLE,
      summary: SMOKE_SUMMARY,
      content: SMOKE_CONTENT,
      category: 'NOTICIA',
      targetAreaId: operacionesAreaId,
      publish: true,
    }),
  });
  const announcement = created.item;
  assert(announcement.status === 'PUBLISHED', `Se esperaba PUBLISHED, recibido: ${announcement.status}`);
  assert(announcement.targetAreaId === operacionesAreaId, 'Área destino incorrecta');
  console.log(`       Comunicado #${announcement.id} publicado ✓`);

  const recipientCount = await countRecipients(operacionesAreaId);
  assert(recipientCount > 0, 'Debe haber destinatarios activos en Operaciones');
  console.log(`       Destinatarios esperados en BD: ${recipientCount}`);

  console.log('[smoke] 4/8 — Colaborador ve el comunicado en el feed');
  await ensureCollaboratorSession();
  const feed = await api('/announcements');
  const inFeed = (feed.items ?? []).some((a) => a.id === announcement.id);
  assert(inFeed, `Comunicado #${announcement.id} no visible en feed del colaborador`);
  console.log('       Visible en feed del colaborador ✓');

  if (smtpConfigured) {
    console.log('[smoke] 5/8 — Esperar envío asíncrono de correos (3s)');
    await sleep(3000);
    console.log('       Revise logs del servidor: [email] Notificaciones comunicado…');
  } else {
    console.log('[smoke] 5/8 — Omitido (sin SMTP); publicación y feed ya validados');
  }

  console.log('[smoke] 6/8 — Admin publica comunicado a toda la empresa');
  await ensureAdminSession();
  const adminCaps = await api('/announcements/capabilities');
  assert(adminCaps.canPublishCompanyWide === true, 'Admin debe poder publicar a toda la empresa');

  const companyTitle = `${SMOKE_TITLE} — empresa`;
  const companyCreated = await api('/announcements', {
    method: 'POST',
    body: JSON.stringify({
      title: companyTitle,
      summary: SMOKE_SUMMARY,
      content: SMOKE_CONTENT,
      category: 'CIRCULAR',
      targetAreaId: null,
      publish: true,
    }),
  });
  assert(companyCreated.item.targetAreaId == null, 'Comunicado empresa debe tener targetAreaId null');
  console.log(`       Comunicado empresa #${companyCreated.item.id} ✓`);

  console.log('[smoke] 7/8 — Colaborador ve comunicado empresa en feed');
  await ensureCollaboratorSession();
  const feed2 = await api('/announcements');
  const seesCompany = (feed2.items ?? []).some((a) => a.title === companyTitle);
  assert(seesCompany, 'Colaborador debe ver comunicado de toda la empresa');
  console.log('       Comunicado empresa visible ✓');

  console.log('[smoke] 8/8 — Gestión lista el borrador/comunicado del gerente');
  await ensureManagerSession();
  const manage = await api('/announcements/manage');
  const inManage = (manage.items ?? []).some((a) => a.id === announcement.id);
  assert(inManage, 'Gerente debe ver su comunicado en gestión');
  console.log('       Listado de gestión OK ✓');

  console.log('\n✅ Smoke test comunicados: OK');
}

main().catch((err) => {
  console.error('\n❌ Smoke test comunicados: FALLÓ');
  console.error(err.message);
  if (err.data) console.error(JSON.stringify(err.data, null, 2));
  process.exit(1);
});
