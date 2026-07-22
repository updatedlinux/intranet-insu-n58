import sql from 'mssql';
import { getPool } from '../config/database';

export interface AreaRow {
  id: number;
  name: string;
  description: string | null;
  parentAreaId: number | null;
  parentAreaName: string | null;
  isActive: boolean;
  isItSupportArea: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AreaListFilters {
  name?: string;
  isActive?: boolean;
}

export interface AreaWriteInput {
  name: string;
  description: string | null;
  parentAreaId: number | null;
  isActive: boolean;
  isItSupportArea: boolean;
}

const AREA_SELECT = `
  a.id,
  a.name,
  a.description,
  a.parentAreaId,
  a.isActive,
  a.isItSupportArea,
  a.createdAt,
  a.updatedAt,
  p.name AS parentAreaName
`;

const AREA_FROM = `
  FROM dbo.Areas a
  LEFT JOIN dbo.Areas p ON a.parentAreaId = p.id
`;

export async function listAreas(filters: AreaListFilters): Promise<AreaRow[]> {
  const pool = getPool();
  const request = pool.request();
  const conditions: string[] = ['1 = 1'];

  if (filters.name?.trim()) {
    request.input('name', sql.NVarChar(255), `%${filters.name.trim()}%`);
    conditions.push('a.name LIKE @name');
  }

  if (filters.isActive != null) {
    request.input('isActive', sql.Bit, filters.isActive ? 1 : 0);
    conditions.push('a.isActive = @isActive');
  }

  const result = await request.query<AreaRow>(`
    SELECT ${AREA_SELECT}
    ${AREA_FROM}
    WHERE ${conditions.join(' AND ')}
    ORDER BY a.name
  `);

  return result.recordset.map(mapAreaRow);
}

function areaDepth(
  areaId: number,
  byId: Map<number, AreaRow>,
  cache: Map<number, number>,
  visiting: Set<number> = new Set(),
): number {
  const cached = cache.get(areaId);
  if (cached != null) return cached;
  if (visiting.has(areaId)) {
    cache.set(areaId, 0);
    return 0;
  }

  visiting.add(areaId);
  const area = byId.get(areaId);
  if (!area?.parentAreaId) {
    cache.set(areaId, 0);
    return 0;
  }

  const parent = byId.get(area.parentAreaId);
  if (!parent) {
    cache.set(areaId, 0);
    return 0;
  }

  const depth = areaDepth(area.parentAreaId, byId, cache, visiting) + 1;
  cache.set(areaId, depth);
  return depth;
}

/** Todas las áreas, padres antes que hijos; padres inexistentes cuentan como raíz. */
export async function listAreasOrderedByDepth(): Promise<AreaRow[]> {
  const all = await listAreas({});
  const byId = new Map(all.map((area) => [area.id, area]));
  const depthCache = new Map<number, number>();

  return [...all].sort((a, b) => {
    const depthDiff = areaDepth(a.id, byId, depthCache) - areaDepth(b.id, byId, depthCache);
    if (depthDiff !== 0) return depthDiff;
    return a.name.localeCompare(b.name, 'es');
  });
}

function mapAreaRow(row: AreaRow): AreaRow {
  return {
    ...row,
    isActive: Boolean(row.isActive),
    isItSupportArea: Boolean(row.isItSupportArea),
  };
}

export async function findAreaById(id: number): Promise<AreaRow | null> {
  const pool = getPool();
  const result = await pool.request().input('id', sql.Int, id).query<AreaRow>(`
    SELECT ${AREA_SELECT}
    ${AREA_FROM}
    WHERE a.id = @id
  `);
  const row = result.recordset[0];
  return row ? mapAreaRow(row) : null;
}

export async function findAreaParentId(id: number): Promise<number | null> {
  const pool = getPool();
  const result = await pool.request().input('id', sql.Int, id).query<{
    parentAreaId: number | null;
  }>(`
      SELECT parentAreaId
      FROM dbo.Areas
      WHERE id = @id
    `);
  return result.recordset[0]?.parentAreaId ?? null;
}

export async function areaNameExists(name: string, excludeId?: number): Promise<boolean> {
  const pool = getPool();
  const request = pool.request().input('name', sql.NVarChar(200), name.trim().toLowerCase());

  let query = `
    SELECT 1 AS found
    FROM dbo.Areas
    WHERE LOWER(LTRIM(RTRIM(name))) = @name
  `;

  if (excludeId != null) {
    request.input('excludeId', sql.Int, excludeId);
    query += ' AND id <> @excludeId';
  }

  const result = await request.query<{ found: number }>(query);
  return (result.recordset[0]?.found ?? 0) > 0;
}

export async function createArea(input: AreaWriteInput): Promise<number> {
  const pool = getPool();
  const result = await pool
    .request()
    .input('name', sql.NVarChar(200), input.name.trim())
    .input('description', sql.NVarChar(500), input.description)
    .input('parentAreaId', sql.Int, input.parentAreaId)
    .input('isActive', sql.Bit, input.isActive ? 1 : 0)
    .input('isItSupportArea', sql.Bit, input.isItSupportArea ? 1 : 0).query<{ id: number }>(`
      INSERT INTO dbo.Areas (name, description, parentAreaId, isActive, isItSupportArea)
      OUTPUT INSERTED.id
      VALUES (@name, @description, @parentAreaId, @isActive, @isItSupportArea)
    `);

  return result.recordset[0]!.id;
}

export async function updateArea(id: number, input: AreaWriteInput): Promise<void> {
  const pool = getPool();
  await pool
    .request()
    .input('id', sql.Int, id)
    .input('name', sql.NVarChar(200), input.name.trim())
    .input('description', sql.NVarChar(500), input.description)
    .input('parentAreaId', sql.Int, input.parentAreaId)
    .input('isActive', sql.Bit, input.isActive ? 1 : 0)
    .input('isItSupportArea', sql.Bit, input.isItSupportArea ? 1 : 0).query(`
      UPDATE dbo.Areas
      SET
        name = @name,
        description = @description,
        parentAreaId = @parentAreaId,
        isActive = @isActive,
        isItSupportArea = @isItSupportArea,
        updatedAt = SYSUTCDATETIME()
      WHERE id = @id
    `);
}

export async function setAreaActive(id: number, isActive: boolean): Promise<void> {
  const pool = getPool();
  await pool
    .request()
    .input('id', sql.Int, id)
    .input('isActive', sql.Bit, isActive ? 1 : 0).query(`
      UPDATE dbo.Areas
      SET isActive = @isActive, updatedAt = SYSUTCDATETIME()
      WHERE id = @id
    `);
}

export async function countActiveCollaboratorsByArea(areaId: number): Promise<number> {
  const pool = getPool();
  const result = await pool.request().input('areaId', sql.Int, areaId).query<{ total: number }>(`
      SELECT COUNT(1) AS total
      FROM dbo.Users
      WHERE areaId = @areaId AND isActive = 1
    `);
  return result.recordset[0]?.total ?? 0;
}

export async function countCollaboratorsByArea(areaId: number): Promise<number> {
  const pool = getPool();
  const result = await pool.request().input('areaId', sql.Int, areaId).query<{ total: number }>(`
      SELECT COUNT(1) AS total
      FROM dbo.Users
      WHERE areaId = @areaId
    `);
  return result.recordset[0]?.total ?? 0;
}

export async function countChildAreas(areaId: number): Promise<number> {
  const pool = getPool();
  const result = await pool.request().input('areaId', sql.Int, areaId).query<{ total: number }>(`
    SELECT COUNT(1) AS total FROM dbo.Areas WHERE parentAreaId = @areaId
  `);
  return result.recordset[0]?.total ?? 0;
}

export async function countPositionsByArea(areaId: number): Promise<number> {
  const pool = getPool();
  const result = await pool.request().input('areaId', sql.Int, areaId).query<{ total: number }>(`
    SELECT COUNT(1) AS total FROM dbo.Positions WHERE areaId = @areaId
  `);
  return result.recordset[0]?.total ?? 0;
}

export async function countDocumentsByArea(areaId: number): Promise<number> {
  const pool = getPool();
  const result = await pool.request().input('areaId', sql.Int, areaId).query<{ total: number }>(`
    SELECT COUNT(1) AS total FROM dbo.Documents WHERE areaId = @areaId
  `);
  return result.recordset[0]?.total ?? 0;
}

export async function countFoldersByArea(areaId: number): Promise<number> {
  const pool = getPool();
  const result = await pool.request().input('areaId', sql.Int, areaId).query<{ total: number }>(`
    SELECT COUNT(1) AS total FROM dbo.Folders WHERE areaId = @areaId
  `);
  return result.recordset[0]?.total ?? 0;
}

export async function countTasksByArea(areaId: number): Promise<number> {
  const pool = getPool();
  const result = await pool.request().input('areaId', sql.Int, areaId).query<{ total: number }>(`
    SELECT COUNT(1) AS total
    FROM dbo.Tasks t
    INNER JOIN dbo.BoardColumns bc ON bc.id = t.columnId
    INNER JOIN dbo.Boards b ON b.id = bc.boardId
    WHERE b.areaId = @areaId
  `);
  return result.recordset[0]?.total ?? 0;
}

export async function countLearningCourseAccessByArea(areaId: number): Promise<number> {
  const pool = getPool();
  const result = await pool.request().input('areaId', sql.Int, areaId).query<{ total: number }>(`
    SELECT COUNT(1) AS total FROM dbo.LearningCourseAccess WHERE areaId = @areaId
  `);
  return result.recordset[0]?.total ?? 0;
}

export async function countCorporateEventAreasByArea(areaId: number): Promise<number> {
  const pool = getPool();
  const result = await pool.request().input('areaId', sql.Int, areaId).query<{ total: number }>(`
    SELECT COUNT(1) AS total FROM dbo.CorporateEventAreas WHERE areaId = @areaId
  `);
  return result.recordset[0]?.total ?? 0;
}

export async function deleteArea(id: number): Promise<void> {
  const pool = getPool();
  const transaction = new sql.Transaction(pool);
  await transaction.begin();

  try {
    const newRequest = () => new sql.Request(transaction);

    await newRequest()
      .input('areaId', sql.Int, id)
      .query(`DELETE FROM dbo.AreaLeaders WHERE areaId = @areaId`);

    await newRequest().input('areaId', sql.Int, id).query(`
        DELETE FROM dbo.AreaAccess
        WHERE sourceAreaId = @areaId OR targetAreaId = @areaId
      `);

    await newRequest()
      .input('areaId', sql.Int, id)
      .query(`DELETE FROM dbo.ChatAreaAccess WHERE areaId = @areaId`);

    await newRequest().input('areaId', sql.Int, id).query(`
        DELETE m
        FROM dbo.ChatMessages m
        INNER JOIN dbo.ChatRooms r ON r.id = m.roomId
        WHERE r.areaId = @areaId
      `);

    await newRequest().input('areaId', sql.Int, id).query(`
        DELETE p
        FROM dbo.ChatParticipants p
        INNER JOIN dbo.ChatRooms r ON r.id = p.roomId
        WHERE r.areaId = @areaId
      `);

    await newRequest()
      .input('areaId', sql.Int, id)
      .query(`DELETE FROM dbo.ChatRooms WHERE areaId = @areaId`);

    await newRequest().input('areaId', sql.Int, id).query(`
        DELETE bc
        FROM dbo.BoardColumns bc
        INNER JOIN dbo.Boards b ON b.id = bc.boardId
        WHERE b.areaId = @areaId
      `);

    await newRequest()
      .input('areaId', sql.Int, id)
      .query(`DELETE FROM dbo.Boards WHERE areaId = @areaId`);

    await newRequest()
      .input('areaId', sql.Int, id)
      .query(`DELETE FROM dbo.Positions WHERE areaId = @areaId`);

    await newRequest().input('id', sql.Int, id).query(`DELETE FROM dbo.Areas WHERE id = @id`);

    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}
