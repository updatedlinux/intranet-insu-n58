import { getPool } from '../config/database';

export interface OrgChartAreaRow {
  id: number;
  name: string;
  parentAreaId: number | null;
}

export async function listActiveAreasForOrgChart(): Promise<OrgChartAreaRow[]> {
  const pool = getPool();
  const result = await pool.request().query<OrgChartAreaRow>(`
    SELECT id, name, parentAreaId
    FROM dbo.Areas
    WHERE isActive = 1
    ORDER BY name
  `);
  return result.recordset;
}
