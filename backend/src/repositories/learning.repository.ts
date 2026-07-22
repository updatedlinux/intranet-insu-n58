import sql from 'mssql';
import { getPool } from '../config/database';
import type { LearningContentType } from '../constants/learning';

export interface LearningCourseRow {
  id: number;
  code: string;
  title: string;
  description: string | null;
  coverUrl: string | null;
  createdBy: number;
  isPublished: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface LearningModuleRow {
  id: number;
  courseId: number;
  title: string;
  order: number;
}

export interface LearningLessonRow {
  id: number;
  moduleId: number;
  title: string;
  description: string | null;
  contentType: LearningContentType;
  fileKey: string | null;
  fileName: string | null;
  fileSize: number | null;
  order: number;
}

export interface CreateCourseInput {
  code: string;
  title: string;
  description: string | null;
  coverUrl: string | null;
  createdBy: number;
  isPublished: boolean;
}

export interface UpdateCourseInput {
  title: string;
  description: string | null;
  coverUrl: string | null;
  isPublished: boolean;
}

const GOVERNANCE_EXISTS = `
  (
    EXISTS (
      SELECT 1 FROM dbo.LearningCourseAccess a
      WHERE a.courseId = c.id AND a.areaId = @areaId
    )
    OR EXISTS (
      SELECT 1 FROM dbo.LearningCourseExceptions e
      WHERE e.courseId = c.id AND e.userId = @userId
    )
  )
`;

export async function generateNextCourseCode(): Promise<string> {
  const pool = getPool();
  const result = await pool.request().query<{ maxNum: number | null }>(`
    SELECT MAX(TRY_CAST(SUBSTRING(code, 5, 20) AS INT)) AS maxNum
    FROM dbo.LearningCourses
    WHERE code LIKE N'CRS-%'
  `);
  const next = (result.recordset[0]?.maxNum ?? 0) + 1;
  return `CRS-${String(next).padStart(3, '0')}`;
}

export async function insertCourse(input: CreateCourseInput): Promise<number> {
  const pool = getPool();
  const result = await pool
    .request()
    .input('code', sql.NVarChar(20), input.code)
    .input('title', sql.NVarChar(300), input.title)
    .input('description', sql.NVarChar(sql.MAX), input.description)
    .input('coverUrl', sql.NVarChar(500), input.coverUrl)
    .input('createdBy', sql.Int, input.createdBy)
    .input('isPublished', sql.Bit, input.isPublished).query<{ id: number }>(`
      INSERT INTO dbo.LearningCourses (code, title, description, coverUrl, createdBy, isPublished)
      OUTPUT INSERTED.id
      VALUES (@code, @title, @description, @coverUrl, @createdBy, @isPublished)
    `);
  return result.recordset[0]!.id;
}

export async function updateCourseRow(id: number, input: UpdateCourseInput): Promise<void> {
  const pool = getPool();
  await pool
    .request()
    .input('id', sql.Int, id)
    .input('title', sql.NVarChar(300), input.title)
    .input('description', sql.NVarChar(sql.MAX), input.description)
    .input('coverUrl', sql.NVarChar(500), input.coverUrl)
    .input('isPublished', sql.Bit, input.isPublished).query(`
      UPDATE dbo.LearningCourses
      SET title = @title, description = @description, coverUrl = @coverUrl,
          isPublished = @isPublished, updatedAt = SYSUTCDATETIME()
      WHERE id = @id
    `);
}

export async function deleteCourseRow(id: number): Promise<void> {
  const pool = getPool();
  await pool.request().input('id', sql.Int, id).query(`
    DELETE FROM dbo.LearningCourses WHERE id = @id
  `);
}

export async function findCourseById(id: number): Promise<LearningCourseRow | null> {
  const pool = getPool();
  const result = await pool.request().input('id', sql.Int, id).query<LearningCourseRow>(`
    SELECT id, code, title, description, coverUrl, createdBy, isPublished, createdAt, updatedAt
    FROM dbo.LearningCourses WHERE id = @id
  `);
  return result.recordset[0] ?? null;
}

export async function listCoursesForUser(
  userId: number,
  areaId: number,
  publishedOnly: boolean,
): Promise<LearningCourseRow[]> {
  const pool = getPool();
  const request = pool.request().input('userId', sql.Int, userId).input('areaId', sql.Int, areaId);
  const publishedClause = publishedOnly ? 'AND c.isPublished = 1' : '';

  const result = await request.query<LearningCourseRow>(`
    SELECT DISTINCT c.id, c.code, c.title, c.description, c.coverUrl, c.createdBy,
           c.isPublished, c.createdAt, c.updatedAt
    FROM dbo.LearningCourses c
    WHERE ${GOVERNANCE_EXISTS.replace(/\n/g, ' ')} ${publishedClause}
    ORDER BY c.updatedAt DESC
  `);
  return result.recordset;
}

export async function listAllCoursesManage(): Promise<LearningCourseRow[]> {
  const pool = getPool();
  const result = await pool.request().query<LearningCourseRow>(`
    SELECT id, code, title, description, coverUrl, createdBy, isPublished, createdAt, updatedAt
    FROM dbo.LearningCourses
    ORDER BY updatedAt DESC
  `);
  return result.recordset;
}

export async function userHasCourseAccess(
  courseId: number,
  userId: number,
  areaId: number,
): Promise<boolean> {
  const pool = getPool();
  const result = await pool
    .request()
    .input('courseId', sql.Int, courseId)
    .input('userId', sql.Int, userId)
    .input('areaId', sql.Int, areaId).query<{ ok: number }>(`
      SELECT 1 AS ok
      FROM dbo.LearningCourses c
      WHERE c.id = @courseId
        AND (
          EXISTS (
            SELECT 1 FROM dbo.LearningCourseAccess a
            WHERE a.courseId = c.id AND a.areaId = @areaId
          )
          OR EXISTS (
            SELECT 1 FROM dbo.LearningCourseExceptions e
            WHERE e.courseId = c.id AND e.userId = @userId
          )
        )
    `);
  return result.recordset.length > 0;
}

export async function replaceCourseAccess(courseId: number, areaIds: number[]): Promise<void> {
  const pool = getPool();
  const tx = new sql.Transaction(pool);
  await tx.begin();
  try {
    await new sql.Request(tx)
      .input('courseId', sql.Int, courseId)
      .query('DELETE FROM dbo.LearningCourseAccess WHERE courseId = @courseId');

    for (const areaId of areaIds) {
      await new sql.Request(tx)
        .input('courseId', sql.Int, courseId)
        .input('areaId', sql.Int, areaId).query(`
          INSERT INTO dbo.LearningCourseAccess (courseId, areaId) VALUES (@courseId, @areaId)
        `);
    }
    await tx.commit();
  } catch (e) {
    await tx.rollback();
    throw e;
  }
}

export async function replaceCourseExceptions(courseId: number, userIds: number[]): Promise<void> {
  const pool = getPool();
  const tx = new sql.Transaction(pool);
  await tx.begin();
  try {
    await new sql.Request(tx)
      .input('courseId', sql.Int, courseId)
      .query('DELETE FROM dbo.LearningCourseExceptions WHERE courseId = @courseId');

    for (const userId of userIds) {
      await new sql.Request(tx)
        .input('courseId', sql.Int, courseId)
        .input('userId', sql.Int, userId).query(`
          INSERT INTO dbo.LearningCourseExceptions (courseId, userId) VALUES (@courseId, @userId)
        `);
    }
    await tx.commit();
  } catch (e) {
    await tx.rollback();
    throw e;
  }
}

export async function listCourseAreaIds(courseId: number): Promise<number[]> {
  const pool = getPool();
  const result = await pool.request().input('courseId', sql.Int, courseId).query<{
    areaId: number;
  }>(`
    SELECT areaId FROM dbo.LearningCourseAccess WHERE courseId = @courseId ORDER BY areaId
  `);
  return result.recordset.map((r) => r.areaId);
}

export async function listCourseExceptionUserIds(courseId: number): Promise<number[]> {
  const pool = getPool();
  const result = await pool.request().input('courseId', sql.Int, courseId).query<{
    userId: number;
  }>(`
      SELECT userId FROM dbo.LearningCourseExceptions WHERE courseId = @courseId ORDER BY userId
    `);
  return result.recordset.map((r) => r.userId);
}

export async function insertModule(
  courseId: number,
  title: string,
  order: number,
): Promise<number> {
  const pool = getPool();
  const result = await pool
    .request()
    .input('courseId', sql.Int, courseId)
    .input('title', sql.NVarChar(300), title)
    .input('order', sql.Int, order).query<{ id: number }>(`
      INSERT INTO dbo.LearningModules (courseId, title, [order])
      OUTPUT INSERTED.id
      VALUES (@courseId, @title, @order)
    `);
  return result.recordset[0]!.id;
}

export async function updateModuleRow(id: number, title: string, order: number): Promise<void> {
  const pool = getPool();
  await pool
    .request()
    .input('id', sql.Int, id)
    .input('title', sql.NVarChar(300), title)
    .input('order', sql.Int, order).query(`
      UPDATE dbo.LearningModules SET title = @title, [order] = @order WHERE id = @id
    `);
}

export async function deleteModuleRow(id: number): Promise<void> {
  const pool = getPool();
  await pool
    .request()
    .input('id', sql.Int, id)
    .query(`DELETE FROM dbo.LearningModules WHERE id = @id`);
}

export async function findModuleById(id: number): Promise<LearningModuleRow | null> {
  const pool = getPool();
  const result = await pool.request().input('id', sql.Int, id).query<LearningModuleRow>(`
    SELECT id, courseId, title, [order] FROM dbo.LearningModules WHERE id = @id
  `);
  return result.recordset[0] ?? null;
}

export async function listModulesByCourse(courseId: number): Promise<LearningModuleRow[]> {
  const pool = getPool();
  const result = await pool.request().input('courseId', sql.Int, courseId)
    .query<LearningModuleRow>(`
    SELECT id, courseId, title, [order] FROM dbo.LearningModules
    WHERE courseId = @courseId ORDER BY [order], id
  `);
  return result.recordset;
}

export async function insertLesson(
  moduleId: number,
  data: {
    title: string;
    description: string | null;
    contentType: LearningContentType;
    fileKey: string;
    fileName: string;
    fileSize: number;
    order: number;
  },
): Promise<number> {
  const pool = getPool();
  const result = await pool
    .request()
    .input('moduleId', sql.Int, moduleId)
    .input('title', sql.NVarChar(300), data.title)
    .input('description', sql.NVarChar(sql.MAX), data.description)
    .input('contentType', sql.NVarChar(20), data.contentType)
    .input('fileKey', sql.NVarChar(500), data.fileKey)
    .input('fileName', sql.NVarChar(300), data.fileName)
    .input('fileSize', sql.BigInt, data.fileSize)
    .input('order', sql.Int, data.order).query<{ id: number }>(`
      INSERT INTO dbo.LearningLessons (moduleId, title, description, contentType, fileKey, fileName, fileSize, [order])
      OUTPUT INSERTED.id
      VALUES (@moduleId, @title, @description, @contentType, @fileKey, @fileName, @fileSize, @order)
    `);
  return result.recordset[0]!.id;
}

export async function updateLessonMeta(
  id: number,
  data: { title: string; description: string | null; order: number },
): Promise<void> {
  const pool = getPool();
  await pool
    .request()
    .input('id', sql.Int, id)
    .input('title', sql.NVarChar(300), data.title)
    .input('description', sql.NVarChar(sql.MAX), data.description)
    .input('order', sql.Int, data.order).query(`
      UPDATE dbo.LearningLessons
      SET title = @title, description = @description, [order] = @order
      WHERE id = @id
    `);
}

export async function deleteLessonRow(id: number): Promise<LearningLessonRow | null> {
  const pool = getPool();
  const found = await findLessonById(id);
  if (!found) return null;
  await pool
    .request()
    .input('id', sql.Int, id)
    .query(`DELETE FROM dbo.LearningLessons WHERE id = @id`);
  return found;
}

export async function findLessonById(id: number): Promise<LearningLessonRow | null> {
  const pool = getPool();
  const result = await pool.request().input('id', sql.Int, id).query<LearningLessonRow>(`
    SELECT id, moduleId, title, description, contentType, fileKey, fileName, fileSize, [order]
    FROM dbo.LearningLessons WHERE id = @id
  `);
  return result.recordset[0] ?? null;
}

export async function findLessonWithCourse(
  lessonId: number,
): Promise<(LearningLessonRow & { courseId: number; isPublished: boolean }) | null> {
  const pool = getPool();
  const result = await pool.request().input('id', sql.Int, lessonId).query<
    LearningLessonRow & { courseId: number; isPublished: boolean }
  >(`
    SELECT l.id, l.moduleId, l.title, l.description, l.contentType, l.fileKey, l.fileName,
           l.fileSize, l.[order], m.courseId, c.isPublished
    FROM dbo.LearningLessons l
    INNER JOIN dbo.LearningModules m ON m.id = l.moduleId
    INNER JOIN dbo.LearningCourses c ON c.id = m.courseId
    WHERE l.id = @id
  `);
  return result.recordset[0] ?? null;
}

export async function listLessonsByModule(moduleId: number): Promise<LearningLessonRow[]> {
  const pool = getPool();
  const result = await pool.request().input('moduleId', sql.Int, moduleId)
    .query<LearningLessonRow>(`
    SELECT id, moduleId, title, description, contentType, fileKey, fileName, fileSize, [order]
    FROM dbo.LearningLessons WHERE moduleId = @moduleId ORDER BY [order], id
  `);
  return result.recordset;
}

export async function countLessonsByCourse(courseId: number): Promise<number> {
  const pool = getPool();
  const result = await pool.request().input('courseId', sql.Int, courseId).query<{
    total: number;
  }>(`
    SELECT COUNT(*) AS total
    FROM dbo.LearningLessons l
    INNER JOIN dbo.LearningModules m ON m.id = l.moduleId
    WHERE m.courseId = @courseId
  `);
  return result.recordset[0]?.total ?? 0;
}

export async function countCompletedLessons(userId: number, courseId: number): Promise<number> {
  const pool = getPool();
  const result = await pool
    .request()
    .input('userId', sql.Int, userId)
    .input('courseId', sql.Int, courseId).query<{ total: number }>(`
      SELECT COUNT(*) AS total
      FROM dbo.LearningUserProgress p
      INNER JOIN dbo.LearningLessons l ON l.id = p.lessonId
      INNER JOIN dbo.LearningModules m ON m.id = l.moduleId
      WHERE p.userId = @userId AND m.courseId = @courseId
    `);
  return result.recordset[0]?.total ?? 0;
}

export async function listCompletedLessonIds(userId: number, courseId: number): Promise<number[]> {
  const pool = getPool();
  const result = await pool
    .request()
    .input('userId', sql.Int, userId)
    .input('courseId', sql.Int, courseId).query<{ lessonId: number }>(`
      SELECT p.lessonId
      FROM dbo.LearningUserProgress p
      INNER JOIN dbo.LearningLessons l ON l.id = p.lessonId
      INNER JOIN dbo.LearningModules m ON m.id = l.moduleId
      WHERE p.userId = @userId AND m.courseId = @courseId
    `);
  return result.recordset.map((r) => r.lessonId);
}

export async function markLessonComplete(userId: number, lessonId: number): Promise<void> {
  const pool = getPool();
  await pool.request().input('userId', sql.Int, userId).input('lessonId', sql.Int, lessonId).query(`
      IF NOT EXISTS (SELECT 1 FROM dbo.LearningUserProgress WHERE userId = @userId AND lessonId = @lessonId)
      INSERT INTO dbo.LearningUserProgress (userId, lessonId) VALUES (@userId, @lessonId)
    `);
}

export async function getLastActivityAt(userId: number, courseId: number): Promise<Date | null> {
  const pool = getPool();
  const result = await pool
    .request()
    .input('userId', sql.Int, userId)
    .input('courseId', sql.Int, courseId).query<{ lastAt: Date | null }>(`
      SELECT MAX(p.completedAt) AS lastAt
      FROM dbo.LearningUserProgress p
      INNER JOIN dbo.LearningLessons l ON l.id = p.lessonId
      INNER JOIN dbo.LearningModules m ON m.id = l.moduleId
      WHERE p.userId = @userId AND m.courseId = @courseId
    `);
  return result.recordset[0]?.lastAt ?? null;
}

export interface CourseReportUserRow {
  userId: number;
  firstName: string;
  lastName: string;
  email: string;
  areaId: number;
  areaName: string;
  enrollmentType: 'AREA' | 'EXCEPTION';
  completedLessons: number;
  totalLessons: number;
  lastActivityAt: Date | null;
  completedAt: Date | null;
}

export async function getCourseReportUsers(courseId: number): Promise<CourseReportUserRow[]> {
  const pool = getPool();
  const result = await pool.request().input('courseId', sql.Int, courseId)
    .query<CourseReportUserRow>(`
    WITH Enrolled AS (
      SELECT DISTINCT u.id AS userId, u.firstName, u.lastName, u.email, u.areaId, a.name AS areaName,
        CASE WHEN ex.userId IS NOT NULL THEN N'EXCEPTION' ELSE N'AREA' END AS enrollmentType
      FROM dbo.Users u
      INNER JOIN dbo.Areas a ON a.id = u.areaId
      INNER JOIN dbo.LearningCourseAccess acc ON acc.courseId = @courseId AND acc.areaId = u.areaId
      LEFT JOIN dbo.LearningCourseExceptions ex ON ex.courseId = @courseId AND ex.userId = u.id
      WHERE u.isActive = 1
      UNION
      SELECT u.id, u.firstName, u.lastName, u.email, u.areaId, a.name, N'EXCEPTION'
      FROM dbo.LearningCourseExceptions ex
      INNER JOIN dbo.Users u ON u.id = ex.userId
      INNER JOIN dbo.Areas a ON a.id = u.areaId
      WHERE ex.courseId = @courseId AND u.isActive = 1
    ),
    LessonTotals AS (
      SELECT COUNT(*) AS totalLessons
      FROM dbo.LearningLessons l
      INNER JOIN dbo.LearningModules m ON m.id = l.moduleId
      WHERE m.courseId = @courseId
    ),
    Progress AS (
      SELECT p.userId, COUNT(*) AS completedLessons, MAX(p.completedAt) AS lastActivityAt
      FROM dbo.LearningUserProgress p
      INNER JOIN dbo.LearningLessons l ON l.id = p.lessonId
      INNER JOIN dbo.LearningModules m ON m.id = l.moduleId
      WHERE m.courseId = @courseId
      GROUP BY p.userId
    )
    SELECT e.userId, e.firstName, e.lastName, e.email, e.areaId, e.areaName, e.enrollmentType,
      ISNULL(pr.completedLessons, 0) AS completedLessons,
      lt.totalLessons,
      pr.lastActivityAt,
      CASE WHEN lt.totalLessons > 0 AND ISNULL(pr.completedLessons, 0) >= lt.totalLessons
        THEN pr.lastActivityAt ELSE NULL END AS completedAt
    FROM Enrolled e
    CROSS JOIN LessonTotals lt
    LEFT JOIN Progress pr ON pr.userId = e.userId
    ORDER BY e.lastName, e.firstName
  `);
  return result.recordset;
}

export async function searchUsersForLearning(
  q: string,
  limit = 20,
): Promise<{ id: number; firstName: string; lastName: string; email: string; areaName: string }[]> {
  const pool = getPool();
  const term = `%${q.trim()}%`;
  const result = await pool
    .request()
    .input('term', sql.NVarChar(255), term)
    .input('limit', sql.Int, limit).query<{
    id: number;
    firstName: string;
    lastName: string;
    email: string;
    areaName: string;
  }>(`
      SELECT TOP (@limit) u.id, u.firstName, u.lastName, u.email, a.name AS areaName
      FROM dbo.Users u
      INNER JOIN dbo.Areas a ON a.id = u.areaId
      WHERE u.isActive = 1
        AND (
          u.firstName LIKE @term OR u.lastName LIKE @term
          OR CONCAT(u.firstName, N' ', u.lastName) LIKE @term OR u.email LIKE @term
        )
      ORDER BY u.lastName, u.firstName
    `);
  return result.recordset;
}
