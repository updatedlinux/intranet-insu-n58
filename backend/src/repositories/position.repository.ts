import sql from 'mssql';
import { getPool } from '../config/database';

export interface PositionRow {
  id: number;
  name: string;
  areaId: number;
  areaName: string;
  isLeader: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface PositionListFilters {
  name?: string;
  areaId?: number;
  isActive?: boolean;
}

export interface PositionWriteInput {
  name: string;
  areaId: number;
  isLeader: boolean;
  isActive: boolean;
}

const POSITION_SELECT = `
  p.id,
  p.name,
  p.areaId,
  p.isLeader,
  p.isActive,
  p.createdAt,
  p.updatedAt,
  a.name AS areaName
`;

const POSITION_FROM = `
  FROM dbo.Positions p
  INNER JOIN dbo.Areas a ON p.areaId = a.id
`;

export async function listPositions(filters: PositionListFilters): Promise<PositionRow[]> {
  const pool = getPool();
  const request = pool.request();
  const conditions: string[] = ['1 = 1'];

  if (filters.name?.trim()) {
    request.input('name', sql.NVarChar(255), `%${filters.name.trim()}%`);
    conditions.push('p.name LIKE @name');
  }

  if (filters.areaId != null) {
    request.input('areaId', sql.Int, filters.areaId);
    conditions.push('p.areaId = @areaId');
  }

  if (filters.isActive != null) {
    request.input('isActive', sql.Bit, filters.isActive ? 1 : 0);
    conditions.push('p.isActive = @isActive');
  }

  const result = await request.query<PositionRow>(`
    SELECT ${POSITION_SELECT}
    ${POSITION_FROM}
    WHERE ${conditions.join(' AND ')}
    ORDER BY a.name, p.name
  `);

  return result.recordset;
}

export async function findPositionById(id: number): Promise<PositionRow | null> {
  const pool = getPool();
  const result = await pool.request().input('id', sql.Int, id).query<PositionRow>(`
    SELECT ${POSITION_SELECT}
    ${POSITION_FROM}
    WHERE p.id = @id
  `);
  return result.recordset[0] ?? null;
}

export async function positionNameExistsInArea(
  name: string,
  areaId: number,
  excludeId?: number,
): Promise<boolean> {
  const pool = getPool();
  const request = pool
    .request()
    .input('name', sql.NVarChar(200), name.trim().toLowerCase())
    .input('areaId', sql.Int, areaId);

  let query = `
    SELECT 1 AS found
    FROM dbo.Positions
    WHERE areaId = @areaId AND LOWER(LTRIM(RTRIM(name))) = @name
  `;

  if (excludeId != null) {
    request.input('excludeId', sql.Int, excludeId);
    query += ' AND id <> @excludeId';
  }

  const result = await request.query<{ found: number }>(query);
  return (result.recordset[0]?.found ?? 0) > 0;
}

export async function createPosition(input: PositionWriteInput): Promise<number> {
  const pool = getPool();
  const result = await pool
    .request()
    .input('name', sql.NVarChar(200), input.name.trim())
    .input('areaId', sql.Int, input.areaId)
    .input('isLeader', sql.Bit, input.isLeader ? 1 : 0)
    .input('isActive', sql.Bit, input.isActive ? 1 : 0).query<{ id: number }>(`
      INSERT INTO dbo.Positions (name, areaId, isLeader, isActive)
      OUTPUT INSERTED.id
      VALUES (@name, @areaId, @isLeader, @isActive)
    `);

  return result.recordset[0]!.id;
}

export async function updatePosition(
  id: number,
  input: PositionWriteInput,
  transaction?: sql.Transaction,
): Promise<void> {
  const request = transaction ? new sql.Request(transaction) : getPool().request();
  await request
    .input('id', sql.Int, id)
    .input('name', sql.NVarChar(200), input.name.trim())
    .input('areaId', sql.Int, input.areaId)
    .input('isLeader', sql.Bit, input.isLeader ? 1 : 0)
    .input('isActive', sql.Bit, input.isActive ? 1 : 0).query(`
      UPDATE dbo.Positions
      SET
        name = @name,
        areaId = @areaId,
        isLeader = @isLeader,
        isActive = @isActive,
        updatedAt = SYSUTCDATETIME()
      WHERE id = @id
    `);
}

export async function setPositionActive(id: number, isActive: boolean): Promise<void> {
  const pool = getPool();
  await pool
    .request()
    .input('id', sql.Int, id)
    .input('isActive', sql.Bit, isActive ? 1 : 0).query(`
      UPDATE dbo.Positions
      SET isActive = @isActive, updatedAt = SYSUTCDATETIME()
      WHERE id = @id
    `);
}

export async function countActiveCollaboratorsByPosition(positionId: number): Promise<number> {
  const pool = getPool();
  const result = await pool.request().input('positionId', sql.Int, positionId).query<{
    total: number;
  }>(`
      SELECT COUNT(1) AS total
      FROM dbo.Users
      WHERE positionId = @positionId AND isActive = 1
    `);
  return result.recordset[0]?.total ?? 0;
}

export async function countCollaboratorsByPosition(positionId: number): Promise<number> {
  const pool = getPool();
  const result = await pool.request().input('positionId', sql.Int, positionId).query<{
    total: number;
  }>(`
      SELECT COUNT(1) AS total
      FROM dbo.Users
      WHERE positionId = @positionId
    `);
  return result.recordset[0]?.total ?? 0;
}

export async function deletePosition(id: number): Promise<void> {
  const pool = getPool();
  await pool.request().input('id', sql.Int, id).query(`
    DELETE FROM dbo.Positions WHERE id = @id
  `);
}
