import sql from 'mssql';
import { getPool } from '../config/database';

export interface AreaLeaderRow {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  areaName: string;
  positionName: string;
}

export interface LedAreaRow {
  id: number;
  name: string;
}

export async function listAreaLeadersByAreaIds(
  areaIds: number[],
): Promise<Map<number, AreaLeaderRow[]>> {
  const map = new Map<number, AreaLeaderRow[]>();
  if (areaIds.length === 0) return map;

  const pool = getPool();
  const request = pool.request();
  const placeholders = areaIds.map((id, i) => {
    request.input(`areaId${i}`, sql.Int, id);
    return `@areaId${i}`;
  });

  const result = await request.query<AreaLeaderRow & { areaId: number }>(`
    SELECT
      al.areaId,
      u.id,
      u.firstName,
      u.lastName,
      u.email,
      a.name AS areaName,
      p.name AS positionName
    FROM dbo.AreaLeaders al
    INNER JOIN dbo.Users u ON al.userId = u.id
    INNER JOIN dbo.Areas ar ON al.areaId = ar.id
    INNER JOIN dbo.Areas a ON u.areaId = a.id
    INNER JOIN dbo.Positions p ON u.positionId = p.id
    WHERE al.areaId IN (${placeholders.join(', ')})
    ORDER BY u.lastName, u.firstName
  `);

  for (const row of result.recordset) {
    const { areaId, ...leader } = row;
    const list = map.get(areaId) ?? [];
    list.push(leader);
    map.set(areaId, list);
  }

  return map;
}

export async function listAreaLeaders(areaId: number): Promise<AreaLeaderRow[]> {
  const map = await listAreaLeadersByAreaIds([areaId]);
  return map.get(areaId) ?? [];
}

export async function listLedAreasByUserId(userId: number): Promise<LedAreaRow[]> {
  const pool = getPool();
  const result = await pool.request().input('userId', sql.Int, userId).query<LedAreaRow>(`
    SELECT ar.id, ar.name
    FROM dbo.AreaLeaders al
    INNER JOIN dbo.Areas ar ON al.areaId = ar.id
    WHERE al.userId = @userId
    ORDER BY ar.name
  `);
  return result.recordset;
}

export async function listLedAreaIdsByUserId(userId: number): Promise<number[]> {
  const areas = await listLedAreasByUserId(userId);
  return areas.map((a) => a.id);
}

export async function replaceAreaLeaders(areaId: number, userIds: number[]): Promise<void> {
  const pool = getPool();
  const transaction = new sql.Transaction(pool);
  await transaction.begin();

  try {
    const request = new sql.Request(transaction);
    await request.input('areaId', sql.Int, areaId).query(`
      DELETE FROM dbo.AreaLeaders WHERE areaId = @areaId
    `);

    const uniqueIds = [...new Set(userIds)];
    for (const userId of uniqueIds) {
      const insertRequest = new sql.Request(transaction);
      await insertRequest.input('areaId', sql.Int, areaId).input('userId', sql.Int, userId).query(`
          INSERT INTO dbo.AreaLeaders (areaId, userId)
          VALUES (@areaId, @userId)
        `);
    }

    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

export async function findActiveUserIds(userIds: number[]): Promise<number[]> {
  if (userIds.length === 0) return [];

  const pool = getPool();
  const request = pool.request();
  const placeholders = userIds.map((id, i) => {
    request.input(`userId${i}`, sql.Int, id);
    return `@userId${i}`;
  });

  const result = await request.query<{ id: number }>(`
    SELECT id
    FROM dbo.Users
    WHERE isActive = 1 AND id IN (${placeholders.join(', ')})
  `);

  return result.recordset.map((r) => r.id);
}
