import sql from 'mssql';
import { getPool } from '../config/database';

export interface AreaAccessRow {
  id: number;
  sourceAreaId: number;
  targetAreaId: number;
  sourceAreaName: string;
  targetAreaName: string;
  canRead: boolean;
  canUpload: boolean;
  canApprove: boolean;
  canAnnounce: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AreaAccessWriteInput {
  sourceAreaId: number;
  targetAreaId: number;
  canRead: boolean;
  canUpload: boolean;
  canApprove: boolean;
  canAnnounce: boolean;
  isActive: boolean;
}

const SELECT = `
  aa.id,
  aa.sourceAreaId,
  aa.targetAreaId,
  sa.name AS sourceAreaName,
  ta.name AS targetAreaName,
  aa.canRead,
  aa.canUpload,
  aa.canApprove,
  aa.canAnnounce,
  aa.isActive,
  aa.createdAt,
  aa.updatedAt
`;

const FROM = `
  FROM dbo.AreaAccess aa
  INNER JOIN dbo.Areas sa ON aa.sourceAreaId = sa.id
  INNER JOIN dbo.Areas ta ON aa.targetAreaId = ta.id
`;

export async function listAreaAccess(filters?: {
  sourceAreaId?: number;
  targetAreaId?: number;
  isActive?: boolean;
}): Promise<AreaAccessRow[]> {
  const pool = getPool();
  const request = pool.request();
  const conditions = ['1 = 1'];

  if (filters?.sourceAreaId != null) {
    request.input('sourceAreaId', sql.Int, filters.sourceAreaId);
    conditions.push('aa.sourceAreaId = @sourceAreaId');
  }
  if (filters?.targetAreaId != null) {
    request.input('targetAreaId', sql.Int, filters.targetAreaId);
    conditions.push('aa.targetAreaId = @targetAreaId');
  }
  if (filters?.isActive != null) {
    request.input('isActive', sql.Bit, filters.isActive ? 1 : 0);
    conditions.push('aa.isActive = @isActive');
  }

  const result = await request.query<AreaAccessRow>(`
    SELECT ${SELECT}
    ${FROM}
    WHERE ${conditions.join(' AND ')}
    ORDER BY sa.name, ta.name
  `);
  return result.recordset;
}

export async function getAreaAccessForSource(sourceAreaId: number): Promise<AreaAccessRow[]> {
  return listAreaAccess({ sourceAreaId, isActive: true });
}

export async function findAreaAccessById(id: number): Promise<AreaAccessRow | null> {
  const pool = getPool();
  const result = await pool.request().input('id', sql.Int, id).query<AreaAccessRow>(`
    SELECT ${SELECT}
    ${FROM}
    WHERE aa.id = @id
  `);
  return result.recordset[0] ?? null;
}

export async function createAreaAccess(input: AreaAccessWriteInput): Promise<number> {
  const pool = getPool();
  const result = await pool
    .request()
    .input('sourceAreaId', sql.Int, input.sourceAreaId)
    .input('targetAreaId', sql.Int, input.targetAreaId)
    .input('canRead', sql.Bit, input.canRead ? 1 : 0)
    .input('canUpload', sql.Bit, input.canUpload ? 1 : 0)
    .input('canApprove', sql.Bit, input.canApprove ? 1 : 0)
    .input('canAnnounce', sql.Bit, input.canAnnounce ? 1 : 0)
    .input('isActive', sql.Bit, input.isActive ? 1 : 0).query<{ id: number }>(`
      INSERT INTO dbo.AreaAccess (
        sourceAreaId, targetAreaId, canRead, canUpload, canApprove, canAnnounce, isActive
      )
      OUTPUT INSERTED.id
      VALUES (
        @sourceAreaId, @targetAreaId, @canRead, @canUpload, @canApprove, @canAnnounce, @isActive
      )
    `);
  return result.recordset[0]!.id;
}

export async function updateAreaAccess(id: number, input: AreaAccessWriteInput): Promise<void> {
  const pool = getPool();
  await pool
    .request()
    .input('id', sql.Int, id)
    .input('sourceAreaId', sql.Int, input.sourceAreaId)
    .input('targetAreaId', sql.Int, input.targetAreaId)
    .input('canRead', sql.Bit, input.canRead ? 1 : 0)
    .input('canUpload', sql.Bit, input.canUpload ? 1 : 0)
    .input('canApprove', sql.Bit, input.canApprove ? 1 : 0)
    .input('canAnnounce', sql.Bit, input.canAnnounce ? 1 : 0)
    .input('isActive', sql.Bit, input.isActive ? 1 : 0).query(`
      UPDATE dbo.AreaAccess
      SET
        sourceAreaId = @sourceAreaId,
        targetAreaId = @targetAreaId,
        canRead = @canRead,
        canUpload = @canUpload,
        canApprove = @canApprove,
        canAnnounce = @canAnnounce,
        isActive = @isActive,
        updatedAt = SYSUTCDATETIME()
      WHERE id = @id
    `);
}

export async function deleteAreaAccess(id: number): Promise<void> {
  const pool = getPool();
  await pool.request().input('id', sql.Int, id).query(`
    DELETE FROM dbo.AreaAccess WHERE id = @id
  `);
}

export async function findAreaLeaderEmails(
  areaId: number,
): Promise<{ id: number; email: string; firstName: string; lastName: string }[]> {
  const pool = getPool();
  const result = await pool.request().input('areaId', sql.Int, areaId).query<{
    id: number;
    email: string;
    firstName: string;
    lastName: string;
  }>(`
    SELECT u.id, u.email, u.firstName, u.lastName
    FROM dbo.AreaLeaders al
    INNER JOIN dbo.Users u ON al.userId = u.id
    WHERE al.areaId = @areaId
      AND u.isActive = 1
  `);
  return result.recordset;
}
