import sql from 'mssql';
import { getPool } from '../config/database';

export async function listItSupportAreaIds(): Promise<number[]> {
  const pool = getPool();
  const result = await pool.request().query<{ id: number }>(`
    SELECT id
    FROM dbo.Areas
    WHERE isActive = 1 AND isItSupportArea = 1
    ORDER BY name
  `);
  return result.recordset.map((r) => r.id);
}

export async function isItSupportAreaId(areaId: number): Promise<boolean> {
  const pool = getPool();
  const result = await pool.request().input('areaId', sql.Int, areaId).query<{ ok: number }>(`
    SELECT TOP 1 1 AS ok
    FROM dbo.Areas
    WHERE id = @areaId AND isActive = 1 AND isItSupportArea = 1
  `);
  return (result.recordset[0]?.ok ?? 0) > 0;
}
