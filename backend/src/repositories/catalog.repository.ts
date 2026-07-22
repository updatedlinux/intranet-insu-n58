import sql from 'mssql';
import { getPool } from '../config/database';

export interface RoleOption {
  id: number;
  name: string;
  description: string | null;
}

export interface AreaOption {
  id: number;
  name: string;
}

export interface PositionOption {
  id: number;
  name: string;
  areaId: number;
}

export async function findActiveRoles(): Promise<RoleOption[]> {
  const pool = getPool();
  const result = await pool.request().query<RoleOption>(`
    SELECT id, name, description
    FROM dbo.Roles
    WHERE isActive = 1
    ORDER BY name
  `);
  return result.recordset;
}

export async function findActiveAreas(): Promise<AreaOption[]> {
  const pool = getPool();
  const result = await pool.request().query<AreaOption>(`
    SELECT id, name
    FROM dbo.Areas
    WHERE isActive = 1
    ORDER BY name
  `);
  return result.recordset;
}

export async function findActivePositionsByArea(areaId?: number): Promise<PositionOption[]> {
  const pool = getPool();
  const request = pool.request();
  let where = 'WHERE p.isActive = 1';
  if (areaId != null) {
    request.input('areaId', sql.Int, areaId);
    where += ' AND p.areaId = @areaId';
  }
  const result = await request.query<PositionOption>(`
    SELECT p.id, p.name, p.areaId
    FROM dbo.Positions p
    ${where}
    ORDER BY p.name
  `);
  return result.recordset;
}

export async function findPositionById(id: number): Promise<PositionOption | null> {
  const pool = getPool();
  const result = await pool.request().input('id', sql.Int, id).query<PositionOption>(`
      SELECT id, name, areaId
      FROM dbo.Positions
      WHERE id = @id AND isActive = 1
    `);
  return result.recordset[0] ?? null;
}

export async function findRoleById(id: number): Promise<RoleOption | null> {
  const pool = getPool();
  const result = await pool.request().input('id', sql.Int, id).query<RoleOption>(`
      SELECT id, name, description
      FROM dbo.Roles
      WHERE id = @id AND isActive = 1
    `);
  return result.recordset[0] ?? null;
}
