#!/usr/bin/env node
'use strict';

/**
 * Smoke E2E Insular Learning — gobernanza, subida a MinIO, streaming y progreso.
 *
 * Uso: npm run smoke:learning
 * Requiere: API en marcha, migración 20250601000030, MinIO accesible.
 */

require('dotenv').config();

const bcrypt = require('bcrypt');
const sql = require('mssql');
const { HeadObjectCommand, S3Client } = require('@aws-sdk/client-s3');

const BASE = process.env.SMOKE_API_URL ?? 'http://localhost:3000/api/v1';
const COOKIE_NAME = process.env.AUTH_COOKIE_NAME ?? 'intranet_session';

const ADMIN_EMAIL = process.env.SMOKE_ADMIN_EMAIL ?? 'admin@yopmail.com';
const COLLABORATOR_EMAIL = process.env.SMOKE_COLLABORATOR_EMAIL ?? 'colaborador@yopmail.com';
const OUTSIDER_EMAIL = process.env.SMOKE_IT_EMAIL ?? 'agente.ti@yopmail.com';

const DEFAULT_PASSWORD = process.env.SEED_COLLABORATOR_PASSWORD?.trim()
  || process.env.SEED_ADMIN_PASSWORD?.trim()
  || 'ChangeMe123!';
const TEST_PASSWORD = process.env.SMOKE_TEST_PASSWORD ?? 'TestDocFlow2026!';

const SMOKE_TITLE = `Smoke Learning ${Date.now()}`;

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

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function withPool(fn) {
  const pool = await sql.connect(dbConfig());
  try {
    return await fn(pool);
  } finally {
    await pool.close();
  }
}

function createMinioClient() {
  const useSSL = process.env.MINIO_USE_SSL === 'true';
  const endpoint = process.env.MINIO_ENDPOINT;
  const port = process.env.MINIO_PORT ?? 9000;
  return new S3Client({
    endpoint: `${useSSL ? 'https' : 'http'}://${endpoint}:${port}`,
    region: 'us-east-1',
    credentials: {
      accessKeyId: (process.env.MINIO_ACCESS_KEY ?? '').trim(),
      secretAccessKey: process.env.MINIO_SECRET_KEY ?? '',
    },
    forcePathStyle: true,
  });
}

async function assertObjectInMinio(key, label) {
  const bucket = process.env.MINIO_BUCKET;
  assert(bucket, 'MINIO_BUCKET no configurado');
  const client = createMinioClient();
  const head = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
  assert((head.ContentLength ?? 0) > 0, `${label}: objeto vacío en MinIO (${key})`);
  return head;
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

async function apiRaw(path, options = {}) {
  const headers = new Headers(options.headers);
  if (cookie) headers.set('Cookie', cookie);
  return fetch(`${BASE}${path}`, { ...options, headers });
}

async function apiExpectFail(path, options, expectedStatus) {
  const response = await apiRaw(path, options);
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
  return { response, data };
}

async function login(email, password) {
  cookie = '';
  return api('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

async function ensureSession(email, passwordCandidates) {
  for (const password of passwordCandidates) {
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
    } catch {
      /* try next */
    }
  }
  throw new Error(`No se pudo iniciar sesión como ${email}`);
}

async function assertLearningTablesExist() {
  await withPool(async (pool) => {
    const result = await pool.request().query(`
      SELECT OBJECT_ID('dbo.LearningCourses', 'U') AS courses,
             OBJECT_ID('dbo.LearningLessons', 'U') AS lessons
    `);
    const row = result.recordset[0];
    assert(row?.courses, 'Tabla LearningCourses no existe. Ejecute: npm run migrate');
    assert(row?.lessons, 'Tabla LearningLessons no existe. Ejecute: npm run migrate');
  });
}

async function getUserArea(email) {
  return withPool(async (pool) => {
    const result = await pool
      .request()
      .input('email', sql.NVarChar(255), email.trim().toLowerCase())
      .query(`
        SELECT u.id, u.email, u.areaId, a.name AS areaName
        FROM dbo.Users u
        INNER JOIN dbo.Areas a ON a.id = u.areaId
        WHERE LOWER(u.email) = @email AND u.isActive = 1
      `);
    return result.recordset[0] ?? null;
  });
}

async function getLessonFileKeys(courseId) {
  return withPool(async (pool) => {
    const result = await pool
      .request()
      .input('courseId', sql.Int, courseId)
      .query(`
        SELECT l.id, l.fileKey, l.contentType, l.fileName, l.fileSize
        FROM dbo.LearningLessons l
        INNER JOIN dbo.LearningModules m ON m.id = l.moduleId
        WHERE m.courseId = @courseId
        ORDER BY l.id
      `);
    return result.recordset;
  });
}

async function getCourseCoverKey(courseId) {
  return withPool(async (pool) => {
    const result = await pool
      .request()
      .input('courseId', sql.Int, courseId)
      .query(`SELECT coverUrl FROM dbo.LearningCourses WHERE id = @courseId`);
    return result.recordset[0]?.coverUrl ?? null;
  });
}

/** PNG mínimo válido 1x1 */
function tinyPngBuffer() {
  return Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64',
  );
}

function tinyPdfBuffer() {
  return Buffer.from(
    '%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n',
    'utf8',
  );
}

/** Contenido binario simulado para probar Range en video/mp4 */
function fakeMp4Buffer() {
  const header = Buffer.from([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d]);
  const body = Buffer.alloc(4096, 0xab);
  return Buffer.concat([header, body]);
}

async function uploadLessons(moduleId, files) {
  const form = new FormData();
  for (const f of files) {
    form.append('files', new Blob([f.buffer], { type: f.mime }), f.name);
  }
  return api(`/learning/manage/modules/${moduleId}/lessons`, { method: 'POST', body: form });
}

async function uploadCover(courseId) {
  const form = new FormData();
  form.append('cover', new Blob([tinyPngBuffer()], { type: 'image/png' }), 'smoke-cover.png');
  return api(`/learning/manage/courses/${courseId}/cover`, { method: 'POST', body: form });
}

async function main() {
  console.log('[smoke-learning] Iniciando E2E Insular Learning…');
  console.log(`[smoke-learning] API: ${BASE}`);

  console.log('[smoke-learning] 1/12 — Verificar tablas Learning');
  await assertLearningTablesExist();

  console.log('[smoke-learning] 2/12 — Sesión administrador');
  const adminSession = await ensureSession(ADMIN_EMAIL, [DEFAULT_PASSWORD, TEST_PASSWORD]);
  console.log(`       Admin: ${adminSession.user.email}`);

  const collabUser = await getUserArea(COLLABORATOR_EMAIL);
  assert(collabUser, `Usuario colaborador no encontrado: ${COLLABORATOR_EMAIL}`);
  console.log(`       Colaborador área: ${collabUser.areaName} (id=${collabUser.areaId})`);

  console.log('[smoke-learning] 3/12 — Crear curso publicado con acceso por área');
  const created = await api('/learning/manage/courses', {
    method: 'POST',
    body: JSON.stringify({
      title: SMOKE_TITLE,
      description: 'Curso generado por smoke-learning.js',
      isPublished: true,
      areaIds: [collabUser.areaId],
      exceptionUserIds: [],
    }),
  });
  const courseId = created.course.id;
  assert(courseId > 0, 'No se obtuvo courseId');
  console.log(`       Curso ${created.course.code} (id=${courseId}) ✓`);

  console.log('[smoke-learning] 4/12 — Crear módulo');
  const mod = await api(`/learning/manage/courses/${courseId}/modules`, {
    method: 'POST',
    body: JSON.stringify({ title: 'Módulo smoke' }),
  });
  const moduleId = mod.id;
  assert(moduleId > 0, 'No se obtuvo moduleId');
  console.log(`       Módulo id=${moduleId} ✓`);

  console.log('[smoke-learning] 5/12 — Subir lecciones (PDF, imagen, video) a MinIO');
  await uploadLessons(moduleId, [
    { name: 'smoke-guide.pdf', mime: 'application/pdf', buffer: tinyPdfBuffer() },
    { name: 'smoke-diagram.png', mime: 'image/png', buffer: tinyPngBuffer() },
    { name: 'smoke-clip.mp4', mime: 'video/mp4', buffer: fakeMp4Buffer() },
  ]);

  const lessons = await getLessonFileKeys(courseId);
  assert(lessons.length === 3, `Se esperaban 3 lecciones, hay ${lessons.length}`);
  const prefix = `learning/courses/${courseId}/`;
  for (const lesson of lessons) {
    assert(lesson.fileKey?.startsWith(prefix), `fileKey fuera de ruta: ${lesson.fileKey}`);
    assert(lesson.fileSize > 0, `fileSize inválido lección #${lesson.id}`);
  }
  console.log(`       ${lessons.length} lecciones registradas con prefijo ${prefix} ✓`);

  console.log('[smoke-learning] 6/12 — Verificar objetos en MinIO (HeadObject)');
  for (const lesson of lessons) {
    const head = await assertObjectInMinio(lesson.fileKey, lesson.contentType);
    console.log(`       ${lesson.fileName}: ${head.ContentLength} bytes en bucket ✓`);
  }

  console.log('[smoke-learning] 7/12 — Subir portada del curso');
  await uploadCover(courseId);
  const coverKey = await getCourseCoverKey(courseId);
  assert(coverKey?.startsWith(prefix), `coverUrl inválida: ${coverKey}`);
  await assertObjectInMinio(coverKey, 'cover');
  console.log(`       Portada en MinIO: ${coverKey} ✓`);

  const pdfLesson = lessons.find((l) => l.contentType === 'PDF');
  const videoLesson = lessons.find((l) => l.contentType === 'VIDEO');
  const imageLesson = lessons.find((l) => l.contentType === 'IMAGE');
  assert(pdfLesson && videoLesson && imageLesson, 'Faltan tipos de lección esperados');

  console.log('[smoke-learning] 8/12 — Colaborador ve curso en catálogo');
  await ensureSession(COLLABORATOR_EMAIL, [TEST_PASSWORD, DEFAULT_PASSWORD]);
  const catalog = await api('/learning/courses');
  const inCatalog = (catalog.items ?? []).some((c) => c.id === courseId);
  assert(inCatalog, `Curso #${courseId} no aparece en catálogo del colaborador`);
  console.log('       Curso visible por gobernanza de área ✓');

  console.log('[smoke-learning] 9/12 — Streaming proxy (200 + Content-Type)');
  for (const lesson of [pdfLesson, imageLesson]) {
    const res = await apiRaw(`/learning/stream/${lesson.id}`);
    assert(res.status === 200, `Stream lección #${lesson.id} → ${res.status}`);
    const ct = res.headers.get('content-type') ?? '';
    assert(ct.length > 0, 'Content-Type vacío');
    const body = Buffer.from(await res.arrayBuffer());
    assert(body.length > 0, `Stream vacío lección #${lesson.id}`);
    console.log(`       ${lesson.contentType} #${lesson.id}: ${res.status} ${ct} (${body.length} B) ✓`);
  }

  console.log('[smoke-learning] 10/12 — Range request video (206 Partial Content)');
  const rangeRes = await apiRaw(`/learning/stream/${videoLesson.id}`, {
    headers: { Range: 'bytes=0-511' },
  });
  assert(rangeRes.status === 206, `Video Range → ${rangeRes.status}, se esperaba 206`);
  const contentRange = rangeRes.headers.get('content-range') ?? '';
  assert(contentRange.startsWith('bytes '), `Content-Range inválido: ${contentRange}`);
  assert(rangeRes.headers.get('accept-ranges') === 'bytes', 'Falta Accept-Ranges: bytes');
  const partial = Buffer.from(await rangeRes.arrayBuffer());
  assert(partial.length === 512, `Partial body=${partial.length}, se esperaban 512 bytes`);
  console.log(`       206 ${contentRange} (${partial.length} B) ✓`);

  console.log('[smoke-learning] 11/12 — Acceso denegado fuera de área + progreso');
  const outsider = await getUserArea(OUTSIDER_EMAIL);
  if (outsider && outsider.areaId !== collabUser.areaId) {
    await ensureSession(OUTSIDER_EMAIL, [TEST_PASSWORD, DEFAULT_PASSWORD, process.env.SMOKE_IT_PASSWORD?.trim()].filter(Boolean));
    await apiExpectFail(`/learning/stream/${pdfLesson.id}`, { method: 'GET' }, 403);
    console.log(`       ${OUTSIDER_EMAIL} recibe 403 al stream ✓`);
  } else {
    console.log(`       (omitido 403: ${OUTSIDER_EMAIL} misma área o no existe)`);
  }

  await ensureSession(COLLABORATOR_EMAIL, [TEST_PASSWORD, DEFAULT_PASSWORD]);
  for (const lesson of lessons) {
    await api(`/learning/lessons/${lesson.id}/complete`, { method: 'POST' });
  }
  const detail = await api(`/learning/courses/${courseId}`);
  assert(detail.progress?.percent === 100, `Progreso=${detail.progress?.percent}, se esperaba 100`);
  console.log('       Lecciones completadas, progreso 100% ✓');

  const coverRes = await apiRaw(`/learning/courses/${courseId}/cover`);
  assert(coverRes.status === 200, `Cover stream → ${coverRes.status}`);
  assert((coverRes.headers.get('content-type') ?? '').startsWith('image/'), 'Cover no es imagen');
  console.log('       Portada accesible vía proxy ✓');

  console.log('[smoke-learning] 12/12 — Reporte de gestión y limpieza');
  await ensureSession(ADMIN_EMAIL, [TEST_PASSWORD, DEFAULT_PASSWORD]);
  const report = await api(`/learning/manage/courses/${courseId}/report`);
  assert((report.items ?? []).some((r) => r.userId === collabUser.id), 'Colaborador no en reporte');
  console.log(`       Reporte: ${report.items?.length ?? 0} inscrito(s) ✓`);

  await api(`/learning/manage/courses/${courseId}`, { method: 'DELETE' });
  console.log(`       Curso #${courseId} eliminado ✓`);

  console.log('\n✅ Smoke test Insular Learning: OK');
}

main().catch((err) => {
  console.error('\n❌ Smoke test Insular Learning: FALLÓ');
  console.error(err.message);
  if (err.data) console.error(JSON.stringify(err.data, null, 2));
  process.exit(1);
});
