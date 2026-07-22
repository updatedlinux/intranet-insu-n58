import sql from 'mssql';
import { getPool } from '../config/database';
import type { DocumentStatus } from '../constants/document-status';

export interface FolderRow {
  id: number;
  name: string;
  description: string | null;
  parentFolderId: number | null;
  areaId: number | null;
  mirrorAreaId: number | null;
  areaOrphanedAt: Date | null;
  isAreaMirror: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface DocumentRow {
  id: number;
  folderId: number;
  name: string;
  description: string | null;
  status: DocumentStatus;
  fileName: string | null;
  fileKey: string | null;
  fileSize: number | null;
  mimeType: string | null;
  areaId: number | null;
  createdBy: number;
  approvedBy: number | null;
  rejectedBy: number | null;
  approvedAt: Date | null;
  rejectedAt: Date | null;
  rejectionReason: string | null;
  isActive: boolean;
  tags: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface DocumentListRow extends DocumentRow {
  uploadedByFirstName: string | null;
  uploadedByLastName: string | null;
  approvedByFirstName: string | null;
  approvedByLastName: string | null;
  areaName: string | null;
}

export interface DocumentVisibilityContext {
  userId: number;
  userAreaId: number;
  isAdmin: boolean;
  isAreaLeader: boolean;
  readableAreaIds: number[];
  approvableAreaIds: number[];
}

export async function findRootFolder(): Promise<FolderRow | null> {
  const pool = getPool();
  const result = await pool.request().query<FolderRow>(`
      SELECT TOP 1 id, name, description, parentFolderId, areaId, mirrorAreaId, areaOrphanedAt, isAreaMirror, isActive, createdAt, updatedAt
      FROM dbo.Folders
      WHERE parentFolderId IS NULL AND isActive = 1
      ORDER BY id
    `);
  return result.recordset[0] ?? null;
}

export async function findAreaRootFolder(areaId: number): Promise<FolderRow | null> {
  const pool = getPool();
  const result = await pool.request().input('areaId', sql.Int, areaId).query<FolderRow>(`
      SELECT TOP 1 f.id, f.name, f.description, f.parentFolderId, f.areaId, f.mirrorAreaId, f.areaOrphanedAt, f.isAreaMirror, f.isActive, f.createdAt, f.updatedAt
      FROM dbo.Folders f
      WHERE f.isActive = 1
        AND (
          f.mirrorAreaId = @areaId
          OR (
            f.areaId = @areaId
            AND f.mirrorAreaId IS NULL
            AND EXISTS (
              SELECT 1 FROM dbo.Folders root
              WHERE root.id = f.parentFolderId AND root.parentFolderId IS NULL
            )
          )
        )
      ORDER BY CASE WHEN f.mirrorAreaId = @areaId THEN 0 ELSE 1 END, f.id
    `);
  return result.recordset[0] ?? null;
}

export async function findFolderById(id: number): Promise<FolderRow | null> {
  const pool = getPool();
  const result = await pool.request().input('id', sql.Int, id).query<FolderRow>(`
      SELECT id, name, description, parentFolderId, areaId, mirrorAreaId, areaOrphanedAt, isAreaMirror, isActive, createdAt, updatedAt
      FROM dbo.Folders
      WHERE id = @id
    `);
  return result.recordset[0] ?? null;
}

export async function listChildFolders(
  parentFolderId: number,
  areaFilter: number[] | null,
): Promise<FolderRow[]> {
  const pool = getPool();
  const request = pool.request().input('parentFolderId', sql.Int, parentFolderId);
  let areaClause = '';

  if (areaFilter != null) {
    if (areaFilter.length === 0) return [];
    const placeholders = areaFilter.map((areaId, i) => {
      const key = `area${i}`;
      request.input(key, sql.Int, areaId);
      return `@${key}`;
    });
    areaClause = ` AND areaId IN (${placeholders.join(', ')})`;
  }

  const result = await request.query<FolderRow>(`
      SELECT id, name, description, parentFolderId, areaId, mirrorAreaId, areaOrphanedAt, isAreaMirror, isActive, createdAt, updatedAt
      FROM dbo.Folders
      WHERE parentFolderId = @parentFolderId AND isActive = 1${areaClause}
      ORDER BY name
    `);
  return result.recordset;
}

export async function createFolder(input: {
  name: string;
  description: string | null;
  parentFolderId: number;
  areaId: number | null;
  isAreaMirror?: boolean;
  mirrorAreaId?: number | null;
}): Promise<number> {
  const pool = getPool();
  const result = await pool
    .request()
    .input('name', sql.NVarChar(200), input.name.trim())
    .input('description', sql.NVarChar(500), input.description)
    .input('parentFolderId', sql.Int, input.parentFolderId)
    .input('areaId', sql.Int, input.areaId)
    .input('isAreaMirror', sql.Bit, input.isAreaMirror ? 1 : 0)
    .input('mirrorAreaId', sql.Int, input.mirrorAreaId ?? null).query<{ id: number }>(`
      INSERT INTO dbo.Folders (name, description, parentFolderId, areaId, isActive, isAreaMirror, mirrorAreaId)
      OUTPUT INSERTED.id
      VALUES (@name, @description, @parentFolderId, @areaId, 1, @isAreaMirror, @mirrorAreaId)
    `);
  return result.recordset[0]!.id;
}

export async function folderNameExistsInParent(
  name: string,
  parentFolderId: number,
  excludeId?: number,
): Promise<boolean> {
  const pool = getPool();
  const request = pool
    .request()
    .input('name', sql.NVarChar(200), name.trim().toLowerCase())
    .input('parentFolderId', sql.Int, parentFolderId);

  let query = `
    SELECT 1 AS found
    FROM dbo.Folders
    WHERE parentFolderId = @parentFolderId
      AND LOWER(LTRIM(RTRIM(name))) = @name
      AND isActive = 1
  `;

  if (excludeId != null) {
    request.input('excludeId', sql.Int, excludeId);
    query += ' AND id <> @excludeId';
  }

  const result = await request.query<{ found: number }>(query);
  return (result.recordset[0]?.found ?? 0) > 0;
}

export interface DocumentListFilters {
  search?: string;
  tagIds?: number[];
}

function bindAreaIdList(request: sql.Request, prefix: string, areaIds: number[]): string {
  return areaIds
    .map((areaId, i) => {
      const key = `${prefix}${i}`;
      request.input(key, sql.Int, areaId);
      return `@${key}`;
    })
    .join(', ');
}

function buildVisibilityClause(
  request: sql.Request,
  ctx: DocumentVisibilityContext,
  alias = 'd',
): string {
  if (ctx.isAdmin) return '1 = 1';

  const readable = bindAreaIdList(request, 'readArea', ctx.readableAreaIds);

  request.input('visUserId', sql.Int, ctx.userId);

  return `(
    (
      ${alias}.status = N'APPROVED'
      AND ${alias}.areaId IN (${readable})
    )
    OR (
      ${alias}.createdBy = @visUserId
      AND ${alias}.status = N'PENDING'
    )
  )`;
}

export async function listDocumentsInFolder(
  folderId: number,
  filters: DocumentListFilters,
  visibility: DocumentVisibilityContext,
): Promise<DocumentListRow[]> {
  const pool = getPool();
  const request = pool.request().input('folderId', sql.Int, folderId);
  const conditions: string[] = [
    'd.folderId = @folderId',
    'd.isActive = 1',
    buildVisibilityClause(request, visibility, 'd'),
  ];

  if (filters.search?.trim()) {
    request.input('search', sql.NVarChar(255), `%${filters.search.trim()}%`);
    conditions.push('d.name LIKE @search');
  }

  if (filters.tagIds && filters.tagIds.length > 0) {
    const placeholders = filters.tagIds.map((tagId, i) => {
      const key = `filterTag${i}`;
      request.input(key, sql.Int, tagId);
      return `@${key}`;
    });
    conditions.push(`
      EXISTS (
        SELECT 1
        FROM dbo.DocumentTags dt
        WHERE dt.documentId = d.id AND dt.tagId IN (${placeholders.join(', ')})
      )
    `);
  }

  const result = await request.query<DocumentListRow>(`
      SELECT
        d.id,
        d.folderId,
        d.name,
        d.description,
        d.status,
        d.fileName,
        d.fileKey,
        d.fileSize,
        d.mimeType,
        d.areaId,
        d.createdBy,
        d.approvedBy,
        d.rejectedBy,
        d.approvedAt,
        d.rejectedAt,
        d.rejectionReason,
        d.isActive,
        d.tags,
        d.createdAt,
        d.updatedAt,
        u.firstName AS uploadedByFirstName,
        u.lastName AS uploadedByLastName,
        au.firstName AS approvedByFirstName,
        au.lastName AS approvedByLastName,
        ar.name AS areaName
      FROM dbo.Documents d
      LEFT JOIN dbo.Users u ON d.createdBy = u.id
      LEFT JOIN dbo.Users au ON d.approvedBy = au.id
      LEFT JOIN dbo.Areas ar ON d.areaId = ar.id
      WHERE ${conditions.join(' AND ')}
      ORDER BY d.name
    `);
  return result.recordset;
}

export async function listPendingDocuments(
  approvableAreaIds: number[] | null,
): Promise<DocumentListRow[]> {
  const pool = getPool();
  const request = pool.request();
  let areaClause = '';

  if (approvableAreaIds != null) {
    if (approvableAreaIds.length === 0) return [];
    const areaList = bindAreaIdList(request, 'pendArea', approvableAreaIds);
    areaClause = ` AND d.areaId IN (${areaList})`;
  }

  const result = await request.query<DocumentListRow>(`
      SELECT
        d.id,
        d.folderId,
        d.name,
        d.description,
        d.status,
        d.fileName,
        d.fileKey,
        d.fileSize,
        d.mimeType,
        d.areaId,
        d.createdBy,
        d.approvedBy,
        d.rejectedBy,
        d.approvedAt,
        d.rejectedAt,
        d.rejectionReason,
        d.isActive,
        d.tags,
        d.createdAt,
        d.updatedAt,
        u.firstName AS uploadedByFirstName,
        u.lastName AS uploadedByLastName,
        au.firstName AS approvedByFirstName,
        au.lastName AS approvedByLastName,
        ar.name AS areaName
      FROM dbo.Documents d
      LEFT JOIN dbo.Users u ON d.createdBy = u.id
      LEFT JOIN dbo.Users au ON d.approvedBy = au.id
      LEFT JOIN dbo.Areas ar ON d.areaId = ar.id
      WHERE d.isActive = 1
        AND d.status = N'PENDING'${areaClause}
      ORDER BY d.createdAt ASC
    `);
  return result.recordset;
}

export async function listMyUploads(userId: number): Promise<DocumentListRow[]> {
  const pool = getPool();
  const result = await pool.request().input('userId', sql.Int, userId).query<DocumentListRow>(`
      SELECT
        d.id,
        d.folderId,
        d.name,
        d.description,
        d.status,
        d.fileName,
        d.fileKey,
        d.fileSize,
        d.mimeType,
        d.areaId,
        d.createdBy,
        d.approvedBy,
        d.rejectedBy,
        d.approvedAt,
        d.rejectedAt,
        d.rejectionReason,
        d.isActive,
        d.tags,
        d.createdAt,
        d.updatedAt,
        u.firstName AS uploadedByFirstName,
        u.lastName AS uploadedByLastName,
        au.firstName AS approvedByFirstName,
        au.lastName AS approvedByLastName,
        ar.name AS areaName
      FROM dbo.Documents d
      LEFT JOIN dbo.Users u ON d.createdBy = u.id
      LEFT JOIN dbo.Users au ON d.approvedBy = au.id
      LEFT JOIN dbo.Areas ar ON d.areaId = ar.id
      WHERE d.createdBy = @userId AND d.isActive = 1
      ORDER BY d.createdAt DESC
    `);
  return result.recordset;
}

export async function listRejectedDocuments(
  userId: number,
  isAdmin: boolean,
  approvableAreaIds: number[],
): Promise<DocumentListRow[]> {
  const pool = getPool();
  const request = pool
    .request()
    .input('userId', sql.Int, userId)
    .input('isAdmin', sql.Bit, isAdmin ? 1 : 0);

  let accessClause = 'd.createdBy = @userId';
  if (isAdmin) {
    accessClause = '1 = 1';
  } else if (approvableAreaIds.length > 0) {
    const placeholders = approvableAreaIds.map((areaId, i) => {
      request.input(`rejArea${i}`, sql.Int, areaId);
      return `@rejArea${i}`;
    });
    accessClause = `(d.createdBy = @userId OR d.areaId IN (${placeholders.join(', ')}))`;
  }

  const result = await request.query<DocumentListRow>(`
      SELECT
        d.id,
        d.folderId,
        d.name,
        d.description,
        d.status,
        d.fileName,
        d.fileKey,
        d.fileSize,
        d.mimeType,
        d.areaId,
        d.createdBy,
        d.approvedBy,
        d.rejectedBy,
        d.approvedAt,
        d.rejectedAt,
        d.rejectionReason,
        d.isActive,
        d.tags,
        d.createdAt,
        d.updatedAt,
        u.firstName AS uploadedByFirstName,
        u.lastName AS uploadedByLastName,
        au.firstName AS approvedByFirstName,
        au.lastName AS approvedByLastName,
        ar.name AS areaName
      FROM dbo.Documents d
      LEFT JOIN dbo.Users u ON d.createdBy = u.id
      LEFT JOIN dbo.Users au ON d.approvedBy = au.id
      LEFT JOIN dbo.Areas ar ON d.areaId = ar.id
      WHERE d.isActive = 1
        AND d.status = N'REJECTED'
        AND (${accessClause})
      ORDER BY d.rejectedAt DESC, d.updatedAt DESC
    `);
  return result.recordset;
}

export async function countRejectedDocuments(
  userId: number,
  isAdmin: boolean,
  approvableAreaIds: number[],
): Promise<number> {
  const pool = getPool();
  const request = pool
    .request()
    .input('userId', sql.Int, userId)
    .input('isAdmin', sql.Bit, isAdmin ? 1 : 0);

  let accessClause = 'd.createdBy = @userId';
  if (isAdmin) {
    accessClause = '1 = 1';
  } else if (approvableAreaIds.length > 0) {
    const placeholders = approvableAreaIds.map((areaId, i) => {
      request.input(`rejCountArea${i}`, sql.Int, areaId);
      return `@rejCountArea${i}`;
    });
    accessClause = `(d.createdBy = @userId OR d.areaId IN (${placeholders.join(', ')}))`;
  }

  const result = await request.query<{ total: number }>(`
      SELECT COUNT(1) AS total
      FROM dbo.Documents d
      WHERE d.isActive = 1
        AND d.status = N'REJECTED'
        AND (${accessClause})
    `);
  return result.recordset[0]?.total ?? 0;
}

export async function countPendingInAreas(approvableAreaIds: number[] | null): Promise<number> {
  const pool = getPool();
  const request = pool.request();
  let areaClause = '';

  if (approvableAreaIds != null) {
    if (approvableAreaIds.length === 0) return 0;
    const areaList = bindAreaIdList(request, 'cntArea', approvableAreaIds);
    areaClause = ` AND areaId IN (${areaList})`;
  }

  const result = await request.query<{ total: number }>(`
    SELECT COUNT(1) AS total
    FROM dbo.Documents
    WHERE isActive = 1 AND status = N'PENDING'${areaClause}
  `);
  return result.recordset[0]?.total ?? 0;
}

export async function findDocumentById(id: number): Promise<DocumentRow | null> {
  const pool = getPool();
  const result = await pool.request().input('id', sql.Int, id).query<DocumentRow>(`
      SELECT
        id, folderId, name, description, status,
        fileName, fileKey, fileSize, mimeType, areaId,
        createdBy, approvedBy, rejectedBy, approvedAt, rejectedAt, rejectionReason,
        isActive, tags, createdAt, updatedAt
      FROM dbo.Documents
      WHERE id = @id
    `);
  return result.recordset[0] ?? null;
}

export async function createDocument(input: {
  folderId: number;
  name: string;
  description: string | null;
  areaId: number | null;
  status: DocumentStatus;
  fileName: string;
  fileKey: string;
  fileSize: number;
  mimeType: string;
  createdBy: number;
  approvedBy?: number | null;
  approvedAt?: Date | null;
}): Promise<number> {
  const pool = getPool();
  const result = await pool
    .request()
    .input('folderId', sql.Int, input.folderId)
    .input('name', sql.NVarChar(255), input.name.trim())
    .input('description', sql.NVarChar(1000), input.description)
    .input('areaId', sql.Int, input.areaId)
    .input('status', sql.NVarChar(20), input.status)
    .input('fileName', sql.NVarChar(255), input.fileName)
    .input('fileKey', sql.NVarChar(512), input.fileKey)
    .input('fileSize', sql.BigInt, input.fileSize)
    .input('mimeType', sql.NVarChar(127), input.mimeType)
    .input('createdBy', sql.Int, input.createdBy)
    .input('approvedBy', sql.Int, input.approvedBy ?? null)
    .input('approvedAt', sql.DateTime2, input.approvedAt ?? null).query<{ id: number }>(`
      INSERT INTO dbo.Documents (
        folderId, name, description, areaId, status,
        fileName, fileKey, fileSize, mimeType,
        createdBy, approvedBy, approvedAt, tags, isActive
      )
      OUTPUT INSERTED.id
      VALUES (
        @folderId, @name, @description, @areaId, @status,
        @fileName, @fileKey, @fileSize, @mimeType,
        @createdBy, @approvedBy, @approvedAt, NULL, 1
      )
    `);
  return result.recordset[0]!.id;
}

export async function approveDocument(documentId: number, approvedBy: number): Promise<void> {
  const pool = getPool();
  await pool.request().input('id', sql.Int, documentId).input('approvedBy', sql.Int, approvedBy)
    .query(`
      UPDATE dbo.Documents
      SET
        status = N'APPROVED',
        approvedBy = @approvedBy,
        approvedAt = SYSUTCDATETIME(),
        rejectedBy = NULL,
        rejectedAt = NULL,
        rejectionReason = NULL,
        updatedAt = SYSUTCDATETIME()
      WHERE id = @id
    `);
}

export async function rejectDocument(
  documentId: number,
  rejectedBy: number,
  reason: string | null,
): Promise<void> {
  const pool = getPool();
  await pool
    .request()
    .input('id', sql.Int, documentId)
    .input('rejectedBy', sql.Int, rejectedBy)
    .input('reason', sql.NVarChar(500), reason).query(`
      UPDATE dbo.Documents
      SET
        status = N'REJECTED',
        rejectedBy = @rejectedBy,
        rejectedAt = SYSUTCDATETIME(),
        rejectionReason = @reason,
        updatedAt = SYSUTCDATETIME()
      WHERE id = @id
    `);
}

export async function deactivateDocument(documentId: number): Promise<void> {
  const pool = getPool();
  await pool.request().input('id', sql.Int, documentId).query(`
      UPDATE dbo.Documents
      SET isActive = 0, updatedAt = SYSUTCDATETIME()
      WHERE id = @id
    `);
}

export async function deactivateFolderTree(folderId: number): Promise<void> {
  const pool = getPool();
  await pool.request().input('folderId', sql.Int, folderId).query(`
      WITH descendants AS (
        SELECT id FROM dbo.Folders WHERE id = @folderId
        UNION ALL
        SELECT f.id
        FROM dbo.Folders f
        INNER JOIN descendants d ON f.parentFolderId = d.id
      )
      UPDATE dbo.Folders
      SET isActive = 0, updatedAt = SYSUTCDATETIME()
      WHERE id IN (SELECT id FROM descendants);

      WITH descendants AS (
        SELECT id FROM dbo.Folders WHERE id = @folderId
        UNION ALL
        SELECT f.id
        FROM dbo.Folders f
        INNER JOIN descendants d ON f.parentFolderId = d.id
      )
      UPDATE dbo.Documents
      SET isActive = 0, updatedAt = SYSUTCDATETIME()
      WHERE folderId IN (SELECT id FROM descendants) AND isActive = 1;
    `);
}

export async function isRootFolder(folderId: number): Promise<boolean> {
  const pool = getPool();
  const result = await pool.request().input('id', sql.Int, folderId).query<{ isRoot: number }>(`
      SELECT CASE WHEN parentFolderId IS NULL THEN 1 ELSE 0 END AS isRoot
      FROM dbo.Folders
      WHERE id = @id
    `);
  return (result.recordset[0]?.isRoot ?? 0) === 1;
}

export async function getFolderAncestors(folderId: number): Promise<FolderRow[]> {
  const pool = getPool();
  const result = await pool.request().input('folderId', sql.Int, folderId).query<FolderRow>(`
      WITH ancestors AS (
        SELECT id, name, description, parentFolderId, areaId, mirrorAreaId, areaOrphanedAt, isAreaMirror, isActive, createdAt, updatedAt
        FROM dbo.Folders
        WHERE id = @folderId
        UNION ALL
        SELECT f.id, f.name, f.description, f.parentFolderId, f.areaId, f.mirrorAreaId, f.areaOrphanedAt, f.isAreaMirror, f.isActive, f.createdAt, f.updatedAt
        FROM dbo.Folders f
        INNER JOIN ancestors a ON f.id = a.parentFolderId
      )
      SELECT * FROM ancestors
      ORDER BY id
    `);
  return result.recordset;
}

export async function findDocumentListRowById(documentId: number): Promise<DocumentListRow | null> {
  const pool = getPool();
  const result = await pool.request().input('id', sql.Int, documentId).query<DocumentListRow>(`
      SELECT
        d.id,
        d.folderId,
        d.name,
        d.description,
        d.status,
        d.fileName,
        d.fileKey,
        d.fileSize,
        d.mimeType,
        d.areaId,
        d.createdBy,
        d.approvedBy,
        d.rejectedBy,
        d.approvedAt,
        d.rejectedAt,
        d.rejectionReason,
        d.isActive,
        d.tags,
        d.createdAt,
        d.updatedAt,
        u.firstName AS uploadedByFirstName,
        u.lastName AS uploadedByLastName,
        au.firstName AS approvedByFirstName,
        au.lastName AS approvedByLastName,
        ar.name AS areaName
      FROM dbo.Documents d
      LEFT JOIN dbo.Users u ON d.createdBy = u.id
      LEFT JOIN dbo.Users au ON d.approvedBy = au.id
      LEFT JOIN dbo.Areas ar ON d.areaId = ar.id
      WHERE d.id = @id
    `);
  return result.recordset[0] ?? null;
}

export async function findMirrorFolderByAreaId(areaId: number): Promise<FolderRow | null> {
  const pool = getPool();
  const result = await pool.request().input('areaId', sql.Int, areaId).query<FolderRow>(`
    SELECT TOP 1 id, name, description, parentFolderId, areaId, mirrorAreaId, areaOrphanedAt, isAreaMirror, isActive, createdAt, updatedAt
    FROM dbo.Folders
    WHERE mirrorAreaId = @areaId AND isAreaMirror = 1
    ORDER BY isActive DESC, id
  `);
  return result.recordset[0] ?? null;
}

export async function updateFolderMirror(
  folderId: number,
  input: {
    name: string;
    description: string | null;
    parentFolderId: number;
    isActive?: boolean;
  },
): Promise<void> {
  const pool = getPool();
  const request = pool
    .request()
    .input('id', sql.Int, folderId)
    .input('name', sql.NVarChar(200), input.name.trim())
    .input('description', sql.NVarChar(500), input.description)
    .input('parentFolderId', sql.Int, input.parentFolderId);

  const activeClause = input.isActive == null ? '' : ', isActive = @isActive';

  if (input.isActive != null) {
    request.input('isActive', sql.Bit, input.isActive ? 1 : 0);
  }

  await request.query(`
      UPDATE dbo.Folders
      SET
        name = @name,
        description = @description,
        parentFolderId = @parentFolderId,
        updatedAt = SYSUTCDATETIME()${activeClause}
      WHERE id = @id
    `);
}

export async function reconcileStaleAreaMirrorFolders(): Promise<number> {
  const pool = getPool();
  const result = await pool.request().query<{ affected: number }>(`
    UPDATE f
    SET
      mirrorAreaId = NULL,
      areaOrphanedAt = COALESCE(f.areaOrphanedAt, SYSUTCDATETIME()),
      areaId = NULL,
      name = CASE
        WHEN f.name LIKE N'% · Área eliminada' THEN f.name
        ELSE f.name + N' · Área eliminada'
      END,
      description = CASE
        WHEN f.description LIKE N'%(área eliminada)%' THEN f.description
        ELSE COALESCE(f.description, N'') + N' (área eliminada)'
      END,
      updatedAt = SYSUTCDATETIME()
    FROM dbo.Folders f
    WHERE f.areaOrphanedAt IS NULL
      AND (
        (f.mirrorAreaId IS NOT NULL AND NOT EXISTS (
          SELECT 1 FROM dbo.Areas a WHERE a.id = f.mirrorAreaId
        ))
        OR (f.areaId IS NOT NULL AND NOT EXISTS (
          SELECT 1 FROM dbo.Areas a WHERE a.id = f.areaId
        ))
      );

    SELECT @@ROWCOUNT AS affected;
  `);
  return result.recordset[0]?.affected ?? 0;
}

export async function orphanFoldersByArea(areaId: number, areaName: string): Promise<number[]> {
  const pool = getPool();
  const result = await pool
    .request()
    .input('areaId', sql.Int, areaId)
    .input(
      'orphanDesc',
      sql.NVarChar(500),
      `Repositorio documental de ${areaName} (área eliminada)`,
    ).query<{ id: number }>(`
      UPDATE dbo.Folders
      SET
        mirrorAreaId = NULL,
        areaOrphanedAt = SYSUTCDATETIME(),
        areaId = NULL,
        name = CASE
          WHEN name LIKE N'% · Área eliminada' THEN name
          ELSE name + N' · Área eliminada'
        END,
        description = @orphanDesc,
        updatedAt = SYSUTCDATETIME()
      OUTPUT INSERTED.id
      WHERE areaId = @areaId OR mirrorAreaId = @areaId
    `);
  return result.recordset.map((row) => row.id);
}

export async function clearDocumentAreaReferences(areaId: number): Promise<void> {
  const pool = getPool();
  await pool.request().input('areaId', sql.Int, areaId).query(`
    UPDATE dbo.Documents
    SET areaId = NULL, updatedAt = SYSUTCDATETIME()
    WHERE areaId = @areaId
  `);
}

export async function listDocumentIdsByArea(areaId: number): Promise<number[]> {
  const pool = getPool();
  const result = await pool.request().input('areaId', sql.Int, areaId).query<{ id: number }>(`
    SELECT id FROM dbo.Documents WHERE areaId = @areaId AND isActive = 1
  `);
  return result.recordset.map((row) => row.id);
}
