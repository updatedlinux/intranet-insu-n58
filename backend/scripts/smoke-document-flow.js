#!/usr/bin/env node
'use strict';

/**
 * Smoke test del flujo documental: colaborador sube → PENDING → admin aprueba/rechaza.
 * Uso: node scripts/smoke-document-flow.js
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

async function login(email, password) {
  cookie = '';
  const result = await api('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  return result;
}

async function ensureCollaboratorSession() {
  let session = await login(COLLABORATOR_EMAIL, DEFAULT_PASSWORD).catch(() => null);
  if (!session) {
    session = await login(COLLABORATOR_EMAIL, TEST_PASSWORD);
    return session;
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
    session = await login(COLLABORATOR_EMAIL, TEST_PASSWORD);
  }
  return session;
}

async function ensureManagerSession() {
  let session = await login(MANAGER_EMAIL, TEST_PASSWORD).catch(() => null);
  if (session) return session;
  return login(MANAGER_EMAIL, DEFAULT_PASSWORD);
}

async function ensureAdminSession() {
  let session = await login(ADMIN_EMAIL, DEFAULT_PASSWORD).catch(() => null);
  if (!session) {
    return login(ADMIN_EMAIL, TEST_PASSWORD);
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
    return login(ADMIN_EMAIL, TEST_PASSWORD);
  }
  return session;
}

async function uploadTestDocument(folderId, label) {
  const form = new FormData();
  const content = `Smoke test ${label} ${new Date().toISOString()}\n`;
  const blob = new Blob([content], { type: 'text/plain' });
  form.append('file', blob, `smoke-${label}.txt`);
  form.append('folderId', String(folderId));
  form.append('name', `Documento smoke ${label}`);
  form.append('description', 'Generado por smoke-document-flow.js');

  return api('/docs/upload', { method: 'POST', body: form });
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function main() {
  console.log('[smoke] Iniciando flujo documental E2E…');
  console.log(`[smoke] API: ${BASE}`);

  console.log('[smoke] 0/6 — Preparar gerente de Operaciones');
  await ensureGerenteUser();
  console.log(`       Usuario gerente: ${MANAGER_EMAIL}`);

  console.log('[smoke] 1/6 — Sesión colaborador');
  const collabSession = await ensureCollaboratorSession();
  console.log(`       Usuario: ${collabSession.user.email} (${collabSession.user.area?.name})`);

  console.log('[smoke] 2/6 — Ubicar carpeta del área Operaciones');
  const rootBrowse = await api('/docs/folders');
  const areaFolder = rootBrowse.folder;
  assert(areaFolder?.name === 'Operaciones', `Se esperaba carpeta Operaciones, recibido: ${areaFolder?.name}`);
  console.log(`       Carpeta destino: ${areaFolder.name} (id=${areaFolder.id})`);

  console.log('[smoke] 3/6 — Subir documento como colaborador');
  const uploadApprove = await uploadTestDocument(areaFolder.id, 'approve');
  const docApprove = uploadApprove.document;
  assert(docApprove.status === 'PENDING', `Se esperaba PENDING, recibido: ${docApprove.status}`);
  console.log(`       Documento #${docApprove.id} creado con status PENDING ✓`);

  console.log('[smoke] 4/6 — Gerente aprueba documento');
  await ensureManagerSession();
  const pending = await api('/docs/pending');
  const pendingList = pending.items ?? [];
  const foundPending = pendingList.find((d) => d.id === docApprove.id);
  assert(foundPending, `Documento #${docApprove.id} no aparece en bandeja de pendientes`);
  console.log(`       Encontrado en pendientes ✓`);

  await api(`/docs/${docApprove.id}/approve`, { method: 'POST', body: '{}' });
  const browseAfterApprove = await api(`/docs/folders/${areaFolder.id}`);
  const approvedDoc = browseAfterApprove.documents.find((d) => d.id === docApprove.id);
  assert(approvedDoc?.status === 'APPROVED', `Tras aprobar se esperaba APPROVED, recibido: ${approvedDoc?.status}`);
  console.log(`       Documento #${docApprove.id} APPROVED ✓`);

  console.log('[smoke] 5/6 — Segundo upload y rechazo');
  await ensureCollaboratorSession();
  const uploadReject = await uploadTestDocument(areaFolder.id, 'reject');
  const docReject = uploadReject.document;
  assert(docReject.status === 'PENDING', `Segundo doc: se esperaba PENDING, recibido: ${docReject.status}`);

  await ensureManagerSession();
  await api(`/docs/${docReject.id}/reject`, {
    method: 'POST',
    body: JSON.stringify({ reason: 'Prueba smoke — rechazo automático' }),
  });

  await ensureCollaboratorSession();
  const myUploads = await api('/docs/my-uploads');
  const rejectedDoc = (myUploads.items ?? []).find((d) => d.id === docReject.id);
  assert(rejectedDoc?.status === 'REJECTED', `Se esperaba REJECTED, recibido: ${rejectedDoc?.status}`);
  console.log(`       Documento #${docReject.id} REJECTED ✓`);

  console.log('[smoke] 6/6 — Flujo completado correctamente');
  console.log('\n✅ Smoke test documental: OK');
}

main().catch((err) => {
  console.error('\n❌ Smoke test documental: FALLÓ');
  console.error(err.message);
  if (err.data) console.error(JSON.stringify(err.data, null, 2));
  process.exit(1);
});
