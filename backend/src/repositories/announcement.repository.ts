import sql from 'mssql';
import { ANNOUNCEMENT_STATUS, type AnnouncementStatus } from '../constants/announcement-status';
import type { AnnouncementCategory } from '../constants/announcement-category';
import { getPool } from '../config/database';

export interface AnnouncementRow {
  id: number;
  title: string;
  content: string;
  summary: string;
  imageUrl: string | null;
  category: AnnouncementCategory;
  targetAreaId: number | null;
  targetAreaName: string | null;
  status: AnnouncementStatus;
  createdBy: number;
  authorFirstName: string;
  authorLastName: string;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AnnouncementWriteInput {
  title: string;
  content: string;
  summary: string;
  imageUrl: string | null;
  category: AnnouncementCategory;
  targetAreaId: number | null;
  status: AnnouncementStatus;
  createdBy: number;
  publishedAt: Date | null;
}

const SELECT = `
  a.id,
  a.title,
  a.content,
  a.summary,
  a.imageUrl,
  a.category,
  a.targetAreaId,
  ta.name AS targetAreaName,
  a.status,
  a.createdBy,
  u.firstName AS authorFirstName,
  u.lastName AS authorLastName,
  a.publishedAt,
  a.createdAt,
  a.updatedAt
`;

const FROM = `
  FROM dbo.Announcements a
  INNER JOIN dbo.Users u ON a.createdBy = u.id
  LEFT JOIN dbo.Areas ta ON a.targetAreaId = ta.id
`;

export interface AnnouncementListFilters {
  status?: AnnouncementStatus | AnnouncementStatus[];
  category?: AnnouncementCategory;
  targetAreaId?: number;
  search?: string;
  /** Área del usuario (feed publicado: propia + targetAreaId NULL) */
  userAreaId?: number;
  /** @deprecated Solo documentos; comunicados usan userAreaId */
  readableAreaIds?: number[];
  includeAllStatuses?: boolean;
  limit?: number;
}

function buildWhere(filters: AnnouncementListFilters): { clause: string; request: sql.Request } {
  const pool = getPool();
  const request = pool.request();
  const conditions: string[] = ['1 = 1'];

  if (!filters.includeAllStatuses) {
    request.input('published', sql.NVarChar(20), ANNOUNCEMENT_STATUS.PUBLISHED);
    conditions.push('a.status = @published');
    if (filters.userAreaId != null) {
      const areaIds =
        filters.readableAreaIds && filters.readableAreaIds.length > 0
          ? [...new Set(filters.readableAreaIds)]
          : [filters.userAreaId];
      if (areaIds.length === 1) {
        request.input('userAreaId', sql.Int, areaIds[0]!);
        conditions.push('(a.targetAreaId IS NULL OR a.targetAreaId = @userAreaId)');
      } else {
        const placeholders = areaIds.map((id, i) => {
          const key = `readableArea${i}`;
          request.input(key, sql.Int, id);
          return `@${key}`;
        });
        conditions.push(
          `(a.targetAreaId IS NULL OR a.targetAreaId IN (${placeholders.join(', ')}))`,
        );
      }
    }
  } else if (filters.status != null) {
    const statuses = Array.isArray(filters.status) ? filters.status : [filters.status];
    const placeholders = statuses.map((s, i) => {
      const key = `status${i}`;
      request.input(key, sql.NVarChar(20), s);
      return `@${key}`;
    });
    conditions.push(`a.status IN (${placeholders.join(', ')})`);
  }

  if (filters.category) {
    request.input('category', sql.NVarChar(20), filters.category);
    conditions.push('a.category = @category');
  }

  if (filters.targetAreaId != null) {
    request.input('filterAreaId', sql.Int, filters.targetAreaId);
    conditions.push('a.targetAreaId = @filterAreaId');
  }

  if (filters.search?.trim()) {
    request.input('search', sql.NVarChar(255), `%${filters.search.trim()}%`);
    conditions.push('(a.title LIKE @search OR a.summary LIKE @search)');
  }

  return { clause: conditions.join(' AND '), request };
}

export async function listAnnouncements(
  filters: AnnouncementListFilters,
): Promise<AnnouncementRow[]> {
  const { clause, request } = buildWhere(filters);
  const top = filters.limit != null ? `TOP (${Math.min(filters.limit, 100)})` : '';

  const result = await request.query<AnnouncementRow>(`
    SELECT ${top} ${SELECT}
    ${FROM}
    WHERE ${clause}
    ORDER BY
      CASE WHEN a.publishedAt IS NULL THEN 1 ELSE 0 END,
      a.publishedAt DESC,
      a.createdAt DESC
  `);
  return result.recordset;
}

export async function findAnnouncementById(id: number): Promise<AnnouncementRow | null> {
  const pool = getPool();
  const result = await pool.request().input('id', sql.Int, id).query<AnnouncementRow>(`
    SELECT ${SELECT}
    ${FROM}
    WHERE a.id = @id
  `);
  return result.recordset[0] ?? null;
}

export async function createAnnouncement(input: AnnouncementWriteInput): Promise<number> {
  const pool = getPool();
  const result = await pool
    .request()
    .input('title', sql.NVarChar(255), input.title)
    .input('content', sql.NVarChar(sql.MAX), input.content)
    .input('summary', sql.NVarChar(500), input.summary)
    .input('imageUrl', sql.NVarChar(512), input.imageUrl)
    .input('category', sql.NVarChar(20), input.category)
    .input('targetAreaId', sql.Int, input.targetAreaId)
    .input('status', sql.NVarChar(20), input.status)
    .input('createdBy', sql.Int, input.createdBy)
    .input('publishedAt', sql.DateTime2, input.publishedAt).query<{ id: number }>(`
      INSERT INTO dbo.Announcements (
        title, content, summary, imageUrl, category, targetAreaId,
        status, createdBy, publishedAt
      )
      OUTPUT INSERTED.id
      VALUES (
        @title, @content, @summary, @imageUrl, @category, @targetAreaId,
        @status, @createdBy, @publishedAt
      )
    `);
  return result.recordset[0]!.id;
}

export async function updateAnnouncement(
  id: number,
  input: Omit<AnnouncementWriteInput, 'createdBy'>,
): Promise<void> {
  const pool = getPool();
  await pool
    .request()
    .input('id', sql.Int, id)
    .input('title', sql.NVarChar(255), input.title)
    .input('content', sql.NVarChar(sql.MAX), input.content)
    .input('summary', sql.NVarChar(500), input.summary)
    .input('imageUrl', sql.NVarChar(512), input.imageUrl)
    .input('category', sql.NVarChar(20), input.category)
    .input('targetAreaId', sql.Int, input.targetAreaId)
    .input('status', sql.NVarChar(20), input.status)
    .input('publishedAt', sql.DateTime2, input.publishedAt).query(`
      UPDATE dbo.Announcements
      SET
        title = @title,
        content = @content,
        summary = @summary,
        imageUrl = @imageUrl,
        category = @category,
        targetAreaId = @targetAreaId,
        status = @status,
        publishedAt = @publishedAt,
        updatedAt = SYSUTCDATETIME()
      WHERE id = @id
    `);
}

export async function setAnnouncementStatus(
  id: number,
  status: AnnouncementStatus,
  publishedAt: Date | null,
): Promise<void> {
  const pool = getPool();
  await pool
    .request()
    .input('id', sql.Int, id)
    .input('status', sql.NVarChar(20), status)
    .input('publishedAt', sql.DateTime2, publishedAt).query(`
      UPDATE dbo.Announcements
      SET status = @status, publishedAt = @publishedAt, updatedAt = SYSUTCDATETIME()
      WHERE id = @id
    `);
}

export async function listAnnouncementRecipientUserIds(
  targetAreaId: number | null,
): Promise<number[]> {
  const pool = getPool();
  const request = pool.request();
  let areaClause = '';

  if (targetAreaId != null) {
    request.input('areaId', sql.Int, targetAreaId);
    areaClause = ' AND u.areaId = @areaId';
  }

  const result = await request.query<{ id: number }>(`
    SELECT u.id
    FROM dbo.Users u
    WHERE u.isActive = 1${areaClause}
  `);
  return result.recordset.map((r) => r.id);
}

export async function listAnnouncementRecipientEmails(
  targetAreaId: number | null,
): Promise<{ email: string; firstName: string; lastName: string }[]> {
  const pool = getPool();
  const request = pool.request();
  let areaClause = '';

  if (targetAreaId != null) {
    request.input('areaId', sql.Int, targetAreaId);
    areaClause = ' AND u.areaId = @areaId';
  }

  const result = await request.query<{ email: string; firstName: string; lastName: string }>(`
    SELECT u.email, u.firstName, u.lastName
    FROM dbo.Users u
    WHERE u.isActive = 1${areaClause}
    ORDER BY u.lastName, u.firstName
  `);
  return result.recordset;
}
