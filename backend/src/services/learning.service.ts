import type { Readable } from 'node:stream';
import { buildLearningCoverKey, buildLearningObjectKey } from '../constants/learning';
import type { LearningContentType } from '../constants/learning';
import {
  assertCanManageLearningCourseAreas,
  assertLearningAreasAllowed,
  canManageLearning,
  canManageLearningCourseAreas,
  getManageableLearningAreaIds,
} from '../policies/learning-access.policy';
import { isSystemAdmin } from '../policies/document-access.policy';
import {
  countCompletedLessons,
  countLessonsByCourse,
  deleteCourseRow,
  deleteLessonRow,
  deleteModuleRow,
  findCourseById,
  findLessonWithCourse,
  findModuleById,
  generateNextCourseCode,
  getCourseReportUsers,
  getLastActivityAt,
  insertCourse,
  insertLesson,
  insertModule,
  listAllCoursesManage,
  listCompletedLessonIds,
  listCourseAreaIds,
  listCourseExceptionUserIds,
  listCoursesForUser,
  listLessonsByModule,
  listModulesByCourse,
  markLessonComplete,
  replaceCourseAccess,
  replaceCourseExceptions,
  searchUsersForLearning,
  updateCourseRow,
  updateLessonMeta,
  updateModuleRow,
  userHasCourseAccess,
} from '../repositories/learning.repository';
import { findActiveAreas } from '../repositories/catalog.repository';
import type { AuthenticatedUser } from '../types/auth';
import {
  contentTypeToMime,
  inferContentTypeFromMime,
  validateCoverMime,
  validateLessonMime,
} from '../utils/learning-files';
import { buildSimpleTextPdf } from '../utils/simple-pdf';
import { parseRangeHeader } from '../utils/range-parser';
import {
  deleteLearningObject,
  getLearningObject,
  headLearningObject,
  uploadLearningObject,
} from './learning-storage.service';

export type CourseStatus = 'NEW' | 'IN_PROGRESS' | 'COMPLETED';

function assertManage(user: AuthenticatedUser): void {
  if (!canManageLearning(user)) {
    const e = new Error('No tiene permisos para gestionar cursos') as Error & {
      statusCode?: number;
    };
    e.statusCode = 403;
    throw e;
  }
}

async function assertCanManageCourseById(user: AuthenticatedUser, courseId: number): Promise<void> {
  assertManage(user);
  if (isSystemAdmin(user)) return;
  const areaIds = await listCourseAreaIds(courseId);
  await assertCanManageLearningCourseAreas(user, areaIds);
}

async function assertCourseAccess(
  user: AuthenticatedUser,
  courseId: number,
  options?: { requirePublished?: boolean },
): Promise<void> {
  const course = await findCourseById(courseId);
  if (!course) {
    const e = new Error('Curso no encontrado') as Error & { statusCode?: number };
    e.statusCode = 404;
    throw e;
  }
  if (options?.requirePublished && !course.isPublished) {
    const e = new Error('Curso no disponible') as Error & { statusCode?: number };
    e.statusCode = 404;
    throw e;
  }
  const has = await userHasCourseAccess(courseId, user.id, user.area.id);
  if (!has && !canManageLearning(user)) {
    const e = new Error('No tiene acceso a este curso') as Error & { statusCode?: number };
    e.statusCode = 403;
    throw e;
  }
}

async function computeCourseProgress(
  userId: number,
  courseId: number,
): Promise<{
  totalLessons: number;
  completedLessons: number;
  percent: number;
  status: CourseStatus;
}> {
  const totalLessons = await countLessonsByCourse(courseId);
  const completedLessons = await countCompletedLessons(userId, courseId);
  const percent = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;
  let status: CourseStatus = 'NEW';
  if (completedLessons > 0 && completedLessons < totalLessons) status = 'IN_PROGRESS';
  if (totalLessons > 0 && completedLessons >= totalLessons) status = 'COMPLETED';
  return { totalLessons, completedLessons, percent, status };
}

export async function listMyCoursesService(user: AuthenticatedUser) {
  const rows = await listCoursesForUser(user.id, user.area.id, true);
  const items = await Promise.all(
    rows.map(async (c) => {
      const progress = await computeCourseProgress(user.id, c.id);
      const lastActivityAt = await getLastActivityAt(user.id, c.id);
      return {
        id: c.id,
        code: c.code,
        title: c.title,
        description: c.description,
        coverUrl: c.coverUrl,
        ...progress,
        lastActivityAt: lastActivityAt?.toISOString() ?? null,
      };
    }),
  );
  return { items };
}

export async function getMyCourseDetailService(user: AuthenticatedUser, courseId: number) {
  await assertCourseAccess(user, courseId, { requirePublished: !canManageLearning(user) });
  const course = await findCourseById(courseId);
  if (!course) throw Object.assign(new Error('Curso no encontrado'), { statusCode: 404 });

  const modules = await listModulesByCourse(courseId);
  const completedIds = new Set(await listCompletedLessonIds(user.id, courseId));
  const progress = await computeCourseProgress(user.id, courseId);

  const modulesWithLessons = await Promise.all(
    modules.map(async (m) => ({
      id: m.id,
      title: m.title,
      order: m.order,
      lessons: (await listLessonsByModule(m.id)).map((l) => ({
        id: l.id,
        title: l.title,
        description: l.description,
        contentType: l.contentType,
        fileName: l.fileName,
        order: l.order,
        completed: completedIds.has(l.id),
      })),
    })),
  );

  return {
    course: {
      id: course.id,
      code: course.code,
      title: course.title,
      description: course.description,
      coverUrl: course.coverUrl,
    },
    modules: modulesWithLessons,
    progress,
    completedLessonIds: [...completedIds],
  };
}

export async function streamLessonService(
  user: AuthenticatedUser,
  lessonId: number,
  rangeHeader?: string,
): Promise<{
  stream: Readable;
  contentType: string;
  contentLength: number;
  statusCode: number;
  contentRange?: string;
  acceptRanges: boolean;
}> {
  const lesson = await findLessonWithCourse(lessonId);
  if (!lesson?.fileKey) {
    throw Object.assign(new Error('Lección no encontrada'), { statusCode: 404 });
  }

  await assertCourseAccess(user, lesson.courseId, {
    requirePublished: !canManageLearning(user),
  });

  const fileSize = lesson.fileSize ?? (await headLearningObject(lesson.fileKey));
  const range = parseRangeHeader(rangeHeader, fileSize);

  const mime = contentTypeToMime(lesson.contentType, lesson.fileName ?? undefined);
  const object = await getLearningObject(lesson.fileKey, range ?? undefined, mime, fileSize);

  const statusCode = object.isPartial ? 206 : 200;
  const contentRange =
    object.contentRange != null
      ? `bytes ${object.contentRange.start}-${object.contentRange.end}/${object.contentRange.total}`
      : undefined;

  return {
    stream: object.stream,
    contentType: mime,
    contentLength: object.contentLength,
    statusCode,
    contentRange,
    acceptRanges: lesson.contentType === 'VIDEO',
  };
}

export async function completeLessonService(user: AuthenticatedUser, lessonId: number) {
  const lesson = await findLessonWithCourse(lessonId);
  if (!lesson) throw Object.assign(new Error('Lección no encontrada'), { statusCode: 404 });
  await assertCourseAccess(user, lesson.courseId, { requirePublished: true });
  await markLessonComplete(user.id, lessonId);
  const progress = await computeCourseProgress(user.id, lesson.courseId);
  return { ok: true, progress };
}

export async function certificateService(
  user: AuthenticatedUser,
  courseId: number,
): Promise<Buffer> {
  await assertCourseAccess(user, courseId, { requirePublished: true });
  const course = await findCourseById(courseId);
  if (!course) throw Object.assign(new Error('Curso no encontrado'), { statusCode: 404 });

  const progress = await computeCourseProgress(user.id, courseId);
  if (progress.status !== 'COMPLETED') {
    throw Object.assign(new Error('Debe completar todas las lecciones'), { statusCode: 400 });
  }

  const fullName = `${user.firstName} ${user.lastName}`.trim();
  const date = new Date().toLocaleDateString('es-PR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return buildSimpleTextPdf([
    'INSULAR LEARNING',
    'Constancia de finalizacion',
    '',
    `Se certifica que ${fullName}`,
    `ha completado el curso: ${course.title}`,
    `Codigo: ${course.code}`,
    '',
    `Fecha: ${date}`,
  ]);
}

// --- Gestión ---

export async function listManageCoursesService(user: AuthenticatedUser) {
  assertManage(user);
  const rows = await listAllCoursesManage();
  const items = await Promise.all(
    rows.map(async (c) => {
      const totalLessons = await countLessonsByCourse(c.id);
      const areaIds = await listCourseAreaIds(c.id);
      const exceptionUserIds = await listCourseExceptionUserIds(c.id);
      return {
        id: c.id,
        code: c.code,
        title: c.title,
        description: c.description,
        coverUrl: c.coverUrl,
        isPublished: c.isPublished,
        totalLessons,
        areaIds,
        exceptionUserIds,
        updatedAt: c.updatedAt.toISOString(),
      };
    }),
  );

  if (isSystemAdmin(user)) return { items };

  const filtered: typeof items = [];
  for (const item of items) {
    if (await canManageLearningCourseAreas(user, item.areaIds)) {
      filtered.push(item);
    }
  }
  return { items: filtered };
}

export async function getManageCourseService(user: AuthenticatedUser, courseId: number) {
  await assertCanManageCourseById(user, courseId);
  const course = await findCourseById(courseId);
  if (!course) throw Object.assign(new Error('Curso no encontrado'), { statusCode: 404 });

  const modules = await listModulesByCourse(courseId);
  const modulesWithLessons = await Promise.all(
    modules.map(async (m) => ({
      id: m.id,
      title: m.title,
      order: m.order,
      lessons: (await listLessonsByModule(m.id)).map((l) => ({
        id: l.id,
        title: l.title,
        description: l.description,
        contentType: l.contentType,
        fileName: l.fileName,
        fileSize: l.fileSize,
        order: l.order,
      })),
    })),
  );

  return {
    course: {
      id: course.id,
      code: course.code,
      title: course.title,
      description: course.description,
      coverUrl: course.coverUrl,
      isPublished: course.isPublished,
      areaIds: await listCourseAreaIds(courseId),
      exceptionUserIds: await listCourseExceptionUserIds(courseId),
    },
    modules: modulesWithLessons,
  };
}

export async function createCourseService(
  user: AuthenticatedUser,
  body: {
    title: string;
    description?: string | null;
    isPublished?: boolean;
    areaIds: number[];
    exceptionUserIds: number[];
  },
) {
  assertManage(user);
  await assertLearningAreasAllowed(user, body.areaIds ?? []);
  const code = await generateNextCourseCode();
  const id = await insertCourse({
    code,
    title: body.title.trim(),
    description: body.description?.trim() || null,
    coverUrl: null,
    createdBy: user.id,
    isPublished: Boolean(body.isPublished),
  });
  await replaceCourseAccess(id, body.areaIds ?? []);
  await replaceCourseExceptions(id, body.exceptionUserIds ?? []);
  return getManageCourseService(user, id);
}

export async function updateCourseService(
  user: AuthenticatedUser,
  courseId: number,
  body: {
    title: string;
    description?: string | null;
    isPublished?: boolean;
    areaIds: number[];
    exceptionUserIds: number[];
  },
) {
  await assertCanManageCourseById(user, courseId);
  await assertLearningAreasAllowed(user, body.areaIds ?? []);
  const course = await findCourseById(courseId);
  if (!course) throw Object.assign(new Error('Curso no encontrado'), { statusCode: 404 });

  await updateCourseRow(courseId, {
    title: body.title.trim(),
    description: body.description?.trim() || null,
    coverUrl: course.coverUrl,
    isPublished: Boolean(body.isPublished),
  });
  await replaceCourseAccess(courseId, body.areaIds ?? []);
  await replaceCourseExceptions(courseId, body.exceptionUserIds ?? []);
  return getManageCourseService(user, courseId);
}

export async function deleteCourseService(
  user: AuthenticatedUser,
  courseId: number,
): Promise<void> {
  await assertCanManageCourseById(user, courseId);
  const course = await findCourseById(courseId);
  if (!course) throw Object.assign(new Error('Curso no encontrado'), { statusCode: 404 });
  await deleteCourseRow(courseId);
}

export async function uploadCourseCoverService(
  user: AuthenticatedUser,
  courseId: number,
  file: { buffer: Buffer; mimetype: string; originalname: string },
) {
  await assertCanManageCourseById(user, courseId);
  if (!validateCoverMime(file.mimetype)) {
    throw Object.assign(new Error('La portada debe ser una imagen'), { statusCode: 400 });
  }
  const course = await findCourseById(courseId);
  if (!course) throw Object.assign(new Error('Curso no encontrado'), { statusCode: 404 });

  const fileKey = buildLearningCoverKey(courseId, file.originalname);
  await uploadLearningObject(fileKey, file.buffer, file.mimetype);
  if (course.coverUrl && course.coverUrl.startsWith('learning/')) {
    void deleteLearningObject(course.coverUrl).catch(() => undefined);
  }
  await updateCourseRow(courseId, {
    title: course.title,
    description: course.description,
    coverUrl: fileKey,
    isPublished: course.isPublished,
  });
  return { coverUrl: fileKey };
}

export async function createModuleService(
  user: AuthenticatedUser,
  courseId: number,
  body: { title: string; order?: number },
) {
  await assertCanManageCourseById(user, courseId);
  if (!(await findCourseById(courseId))) {
    throw Object.assign(new Error('Curso no encontrado'), { statusCode: 404 });
  }
  const modules = await listModulesByCourse(courseId);
  const order = body.order ?? modules.length;
  const id = await insertModule(courseId, body.title.trim(), order);
  return { id, courseId, title: body.title.trim(), order };
}

export async function updateModuleService(
  user: AuthenticatedUser,
  moduleId: number,
  body: { title: string; order: number },
) {
  assertManage(user);
  const mod = await findModuleById(moduleId);
  if (!mod) throw Object.assign(new Error('Módulo no encontrado'), { statusCode: 404 });
  await assertCanManageCourseById(user, mod.courseId);
  await updateModuleRow(moduleId, body.title.trim(), body.order);
  return { id: moduleId, ...body };
}

export async function deleteModuleService(
  user: AuthenticatedUser,
  moduleId: number,
): Promise<void> {
  assertManage(user);
  const mod = await findModuleById(moduleId);
  if (!mod) throw Object.assign(new Error('Módulo no encontrado'), { statusCode: 404 });
  await assertCanManageCourseById(user, mod.courseId);
  const lessons = await listLessonsByModule(moduleId);
  for (const l of lessons) {
    if (l.fileKey) void deleteLearningObject(l.fileKey).catch(() => undefined);
  }
  await deleteModuleRow(moduleId);
}

export async function uploadLessonsService(
  user: AuthenticatedUser,
  moduleId: number,
  files: { buffer: Buffer; mimetype: string; originalname: string; size: number }[],
) {
  assertManage(user);
  const mod = await findModuleById(moduleId);
  if (!mod) throw Object.assign(new Error('Módulo no encontrado'), { statusCode: 404 });
  await assertCanManageCourseById(user, mod.courseId);

  const existing = await listLessonsByModule(moduleId);
  let order = existing.length;
  const created: { id: number; title: string; contentType: LearningContentType }[] = [];

  for (const file of files) {
    const contentType = inferContentTypeFromMime(file.mimetype);
    if (!contentType || !validateLessonMime(file.mimetype)) {
      throw Object.assign(new Error(`Tipo no permitido: ${file.originalname}`), {
        statusCode: 400,
      });
    }
    const fileKey = buildLearningObjectKey(mod.courseId, file.originalname);
    await uploadLearningObject(fileKey, file.buffer, file.mimetype);
    const title = file.originalname.replace(/\.[^.]+$/, '') || file.originalname;
    const id = await insertLesson(moduleId, {
      title,
      description: null,
      contentType,
      fileKey,
      fileName: file.originalname,
      fileSize: file.size,
      order,
    });
    order += 1;
    created.push({ id, title, contentType });
  }

  return { lessons: created };
}

export async function updateLessonService(
  user: AuthenticatedUser,
  lessonId: number,
  body: { title: string; description?: string | null; order: number },
) {
  assertManage(user);
  const lesson = await findLessonWithCourse(lessonId);
  if (!lesson) {
    throw Object.assign(new Error('Lección no encontrada'), { statusCode: 404 });
  }
  await assertCanManageCourseById(user, lesson.courseId);
  await updateLessonMeta(lessonId, {
    title: body.title.trim(),
    description: body.description?.trim() || null,
    order: body.order,
  });
  return { id: lessonId, ...body };
}

export async function deleteLessonService(
  user: AuthenticatedUser,
  lessonId: number,
): Promise<void> {
  assertManage(user);
  const lessonCtx = await findLessonWithCourse(lessonId);
  if (!lessonCtx) throw Object.assign(new Error('Lección no encontrada'), { statusCode: 404 });
  await assertCanManageCourseById(user, lessonCtx.courseId);
  const lesson = await deleteLessonRow(lessonId);
  if (!lesson) throw Object.assign(new Error('Lección no encontrada'), { statusCode: 404 });
  if (lesson.fileKey) void deleteLearningObject(lesson.fileKey).catch(() => undefined);
}

export async function courseReportService(user: AuthenticatedUser, courseId: number) {
  await assertCanManageCourseById(user, courseId);
  if (!(await findCourseById(courseId))) {
    throw Object.assign(new Error('Curso no encontrado'), { statusCode: 404 });
  }
  const users = await getCourseReportUsers(courseId);
  return {
    items: users.map((u) => ({
      userId: u.userId,
      fullName: `${u.firstName} ${u.lastName}`.trim(),
      email: u.email,
      areaName: u.areaName,
      enrollmentType: u.enrollmentType,
      completedLessons: u.completedLessons,
      totalLessons: u.totalLessons,
      percent: u.totalLessons > 0 ? Math.round((u.completedLessons / u.totalLessons) * 100) : 0,
      lastActivityAt: u.lastActivityAt?.toISOString() ?? null,
      completedAt: u.completedAt?.toISOString() ?? null,
    })),
  };
}

export async function searchLearningUsersService(user: AuthenticatedUser, q: string) {
  assertManage(user);
  if (!q.trim()) return { items: [] };
  const items = await searchUsersForLearning(q, 25);
  return {
    items: items.map((u) => ({
      id: u.id,
      fullName: `${u.firstName} ${u.lastName}`.trim(),
      email: u.email,
      areaName: u.areaName,
    })),
  };
}

export async function listLearningAreasService(user: AuthenticatedUser) {
  assertManage(user);
  const areas = await findActiveAreas();
  const manageable = await getManageableLearningAreaIds(user);
  if (manageable === 'all') return { areas };
  const allowed = new Set(manageable);
  return { areas: areas.filter((a) => allowed.has(a.id)) };
}

export async function streamCourseCoverService(
  user: AuthenticatedUser,
  courseId: number,
): Promise<{ stream: Readable; contentType: string }> {
  const course = await findCourseById(courseId);
  if (!course?.coverUrl) {
    throw Object.assign(new Error('Portada no disponible'), { statusCode: 404 });
  }
  const isStudent = !canManageLearning(user);
  if (isStudent) {
    await assertCourseAccess(user, courseId, { requirePublished: true });
  } else {
    await assertCanManageCourseById(user, courseId);
  }
  const object = await getLearningObject(course.coverUrl, undefined, 'image/jpeg');
  return { stream: object.stream, contentType: object.contentType };
}
