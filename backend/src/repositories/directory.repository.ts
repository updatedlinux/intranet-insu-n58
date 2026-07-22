import sql from 'mssql';
import { getPool } from '../config/database';

export interface DirectoryListFilters {
  name?: string;
  areaId?: number;
  positionId?: number;
}

export interface DirectoryEntryRow {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  areaId: number;
  areaName: string;
  positionId: number;
  positionName: string;
  avatarUrl: string | null;
}

function buildWhere(filters: DirectoryListFilters): { clause: string; request: sql.Request } {
  const pool = getPool();
  const request = pool.request();
  const conditions = ['u.isActive = 1', 'a.isActive = 1', 'p.isActive = 1'];

  if (filters.name?.trim()) {
    const term = `%${filters.name.trim()}%`;
    request.input('name', sql.NVarChar(255), term);
    conditions.push(
      "(u.firstName LIKE @name OR u.lastName LIKE @name OR CONCAT(u.firstName, N' ', u.lastName) LIKE @name)",
    );
  }

  if (filters.areaId != null) {
    request.input('areaId', sql.Int, filters.areaId);
    conditions.push('u.areaId = @areaId');
  }

  if (filters.positionId != null) {
    request.input('positionId', sql.Int, filters.positionId);
    conditions.push('u.positionId = @positionId');
  }

  return { clause: conditions.join(' AND '), request };
}

export async function listDirectoryEntries(
  filters: DirectoryListFilters,
): Promise<DirectoryEntryRow[]> {
  const { clause, request } = buildWhere(filters);

  const result = await request.query<DirectoryEntryRow>(`
    SELECT
      u.id,
      u.firstName,
      u.lastName,
      u.email,
      u.areaId,
      a.name AS areaName,
      u.positionId,
      p.name AS positionName,
      u.avatarUrl
    FROM dbo.Users u
    INNER JOIN dbo.Areas a ON u.areaId = a.id
    INNER JOIN dbo.Positions p ON u.positionId = p.id
    WHERE ${clause}
    ORDER BY u.lastName ASC, u.firstName ASC
  `);

  return result.recordset;
}
