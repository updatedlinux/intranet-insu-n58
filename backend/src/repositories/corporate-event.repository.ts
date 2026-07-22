import sql from 'mssql';
import type { CorporateEventStatus } from '../constants/corporate-event-status';
import { getPool } from '../config/database';

export interface CorporateEventRow {
  id: number;
  title: string;
  description: string | null;
  location: string | null;
  startDateTime: Date;
  endDateTime: Date;
  isCompanyWide: boolean;
  status: CorporateEventStatus;
  createdBy: number;
  creatorFirstName: string;
  creatorLastName: string;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  areaNames: string | null;
  areaIds: string | null;
}

export interface CorporateEventListFilters {
  status?: CorporateEventStatus;
  search?: string;
  fromDate?: Date;
  toDate?: Date;
}

export type CorporateEventListTab = 'upcoming' | 'past';

const EVENT_SELECT = `
  e.id,
  e.title,
  e.description,
  e.location,
  e.startDateTime,
  e.endDateTime,
  e.isCompanyWide,
  e.status,
  e.createdBy,
  u.firstName AS creatorFirstName,
  u.lastName AS creatorLastName,
  e.publishedAt,
  e.createdAt,
  e.updatedAt,
  STUFF((
    SELECT N', ' + a.name
    FROM dbo.CorporateEventAreas cea
    INNER JOIN dbo.Areas a ON a.id = cea.areaId
    WHERE cea.eventId = e.id
    ORDER BY a.name
    FOR XML PATH(''), TYPE
  ).value('.', 'NVARCHAR(MAX)'), 1, 2, '') AS areaNames,
  STUFF((
    SELECT N',' + CAST(cea.areaId AS NVARCHAR(20))
    FROM dbo.CorporateEventAreas cea
    WHERE cea.eventId = e.id
    FOR XML PATH(''), TYPE
  ).value('.', 'NVARCHAR(MAX)'), 1, 1, '') AS areaIds
`;

const EVENT_FROM = `
  FROM dbo.CorporateEvents e
  INNER JOIN dbo.Users u ON u.id = e.createdBy
`;

function mapRow(row: CorporateEventRow): CorporateEventRow {
  return { ...row, isCompanyWide: Boolean(row.isCompanyWide) };
}

export async function listCorporateEventsForUser(
  userAreaId: number,
  tab: CorporateEventListTab,
): Promise<CorporateEventRow[]> {
  const pool = getPool();
  const request = pool.request().input('userAreaId', sql.Int, userAreaId);

  const conditions = [
    `e.status = N'PUBLISHED'`,
    `(e.isCompanyWide = 1 OR EXISTS (
      SELECT 1 FROM dbo.CorporateEventAreas cea
      WHERE cea.eventId = e.id AND cea.areaId = @userAreaId
    ))`,
  ];

  if (tab === 'upcoming') {
    conditions.push('e.endDateTime >= SYSUTCDATETIME()');
  } else {
    conditions.push('e.endDateTime < SYSUTCDATETIME()');
  }

  const result = await request.query<CorporateEventRow>(`
    SELECT ${EVENT_SELECT}
    ${EVENT_FROM}
    WHERE ${conditions.join(' AND ')}
    ORDER BY e.startDateTime ${tab === 'upcoming' ? 'ASC' : 'DESC'}
  `);

  return result.recordset.map(mapRow);
}

export async function listUpcomingCorporateEventsForUser(
  userAreaId: number,
  limit = 5,
): Promise<CorporateEventRow[]> {
  const pool = getPool();
  const top = Math.min(Math.max(limit, 1), 20);
  const result = await pool.request().input('userAreaId', sql.Int, userAreaId)
    .query<CorporateEventRow>(`
      SELECT TOP (${top}) ${EVENT_SELECT}
      ${EVENT_FROM}
      WHERE e.status = N'PUBLISHED'
        AND e.endDateTime >= SYSUTCDATETIME()
        AND (e.isCompanyWide = 1 OR EXISTS (
          SELECT 1 FROM dbo.CorporateEventAreas cea
          WHERE cea.eventId = e.id AND cea.areaId = @userAreaId
        ))
      ORDER BY e.startDateTime ASC
    `);
  return result.recordset.map(mapRow);
}

export async function countUpcomingCorporateEventsForUser(userAreaId: number): Promise<number> {
  const pool = getPool();
  const result = await pool.request().input('userAreaId', sql.Int, userAreaId).query<{
    cnt: number;
  }>(`
    SELECT COUNT(*) AS cnt
    FROM dbo.CorporateEvents e
    WHERE e.status = N'PUBLISHED'
      AND e.endDateTime >= SYSUTCDATETIME()
      AND (e.isCompanyWide = 1 OR EXISTS (
        SELECT 1 FROM dbo.CorporateEventAreas cea
        WHERE cea.eventId = e.id AND cea.areaId = @userAreaId
      ))
  `);
  return result.recordset[0]?.cnt ?? 0;
}

export async function findCorporateEventById(id: number): Promise<CorporateEventRow | null> {
  const pool = getPool();
  const result = await pool.request().input('id', sql.Int, id).query<CorporateEventRow>(`
    SELECT ${EVENT_SELECT}
    ${EVENT_FROM}
    WHERE e.id = @id
  `);
  const row = result.recordset[0];
  return row ? mapRow(row) : null;
}

export async function userCanViewCorporateEvent(
  eventId: number,
  userAreaId: number,
): Promise<boolean> {
  const pool = getPool();
  const result = await pool
    .request()
    .input('id', sql.Int, eventId)
    .input('userAreaId', sql.Int, userAreaId).query<{ ok: number }>(`
      SELECT TOP 1 1 AS ok
      FROM dbo.CorporateEvents e
      WHERE e.id = @id
        AND e.status = N'PUBLISHED'
        AND (e.isCompanyWide = 1 OR EXISTS (
          SELECT 1 FROM dbo.CorporateEventAreas cea
          WHERE cea.eventId = e.id AND cea.areaId = @userAreaId
        ))
    `);
  return (result.recordset[0]?.ok ?? 0) > 0;
}

export async function listCorporateEventsManage(
  filters: CorporateEventListFilters = {},
): Promise<CorporateEventRow[]> {
  const pool = getPool();
  const request = pool.request();
  const conditions: string[] = ['1 = 1'];

  if (filters.status) {
    request.input('status', sql.NVarChar(20), filters.status);
    conditions.push('e.status = @status');
  }
  if (filters.search?.trim()) {
    request.input('search', sql.NVarChar(200), `%${filters.search.trim()}%`);
    conditions.push('(e.title LIKE @search OR e.location LIKE @search)');
  }
  if (filters.fromDate) {
    request.input('fromDate', sql.DateTime2, filters.fromDate);
    conditions.push('e.startDateTime >= @fromDate');
  }
  if (filters.toDate) {
    request.input('toDate', sql.DateTime2, filters.toDate);
    conditions.push('e.endDateTime <= @toDate');
  }

  const result = await request.query<CorporateEventRow>(`
    SELECT ${EVENT_SELECT}
    ${EVENT_FROM}
    WHERE ${conditions.join(' AND ')}
    ORDER BY e.startDateTime DESC, e.id DESC
  `);
  return result.recordset.map(mapRow);
}

export async function listCorporateEventAreaIds(eventId: number): Promise<number[]> {
  const pool = getPool();
  const result = await pool.request().input('eventId', sql.Int, eventId).query<{ areaId: number }>(`
    SELECT areaId FROM dbo.CorporateEventAreas WHERE eventId = @eventId ORDER BY areaId
  `);
  return result.recordset.map((r) => r.areaId);
}

export async function replaceCorporateEventAreas(
  eventId: number,
  areaIds: number[],
): Promise<void> {
  const pool = getPool();
  const tx = new sql.Transaction(pool);
  await tx.begin();
  try {
    await new sql.Request(tx)
      .input('eventId', sql.Int, eventId)
      .query('DELETE FROM dbo.CorporateEventAreas WHERE eventId = @eventId');

    for (const areaId of areaIds) {
      await new sql.Request(tx).input('eventId', sql.Int, eventId).input('areaId', sql.Int, areaId)
        .query(`
          INSERT INTO dbo.CorporateEventAreas (eventId, areaId)
          VALUES (@eventId, @areaId)
        `);
    }
    await tx.commit();
  } catch (error) {
    await tx.rollback();
    throw error;
  }
}

export async function insertCorporateEvent(data: {
  title: string;
  description: string | null;
  location: string | null;
  startDateTime: Date;
  endDateTime: Date;
  isCompanyWide: boolean;
  createdBy: number;
  areaIds: number[];
}): Promise<number> {
  const pool = getPool();
  const tx = new sql.Transaction(pool);
  await tx.begin();
  try {
    const result = await new sql.Request(tx)
      .input('title', sql.NVarChar(255), data.title)
      .input('description', sql.NVarChar(sql.MAX), data.description)
      .input('location', sql.NVarChar(300), data.location)
      .input('startDateTime', sql.DateTime2, data.startDateTime)
      .input('endDateTime', sql.DateTime2, data.endDateTime)
      .input('isCompanyWide', sql.Bit, data.isCompanyWide ? 1 : 0)
      .input('createdBy', sql.Int, data.createdBy).query<{ id: number }>(`
        INSERT INTO dbo.CorporateEvents (
          title, description, location, startDateTime, endDateTime,
          isCompanyWide, status, createdBy
        )
        OUTPUT INSERTED.id
        VALUES (
          @title, @description, @location, @startDateTime, @endDateTime,
          @isCompanyWide, N'DRAFT', @createdBy
        )
      `);
    const eventId = result.recordset[0]!.id;

    if (!data.isCompanyWide) {
      for (const areaId of data.areaIds) {
        await new sql.Request(tx)
          .input('eventId', sql.Int, eventId)
          .input('areaId', sql.Int, areaId).query(`
            INSERT INTO dbo.CorporateEventAreas (eventId, areaId) VALUES (@eventId, @areaId)
          `);
      }
    }

    await tx.commit();
    return eventId;
  } catch (error) {
    await tx.rollback();
    throw error;
  }
}

export async function updateCorporateEvent(
  id: number,
  data: {
    title: string;
    description: string | null;
    location: string | null;
    startDateTime: Date;
    endDateTime: Date;
    isCompanyWide: boolean;
    areaIds: number[];
  },
): Promise<void> {
  const pool = getPool();
  const tx = new sql.Transaction(pool);
  await tx.begin();
  try {
    await new sql.Request(tx)
      .input('id', sql.Int, id)
      .input('title', sql.NVarChar(255), data.title)
      .input('description', sql.NVarChar(sql.MAX), data.description)
      .input('location', sql.NVarChar(300), data.location)
      .input('startDateTime', sql.DateTime2, data.startDateTime)
      .input('endDateTime', sql.DateTime2, data.endDateTime)
      .input('isCompanyWide', sql.Bit, data.isCompanyWide ? 1 : 0).query(`
        UPDATE dbo.CorporateEvents
        SET title = @title,
            description = @description,
            location = @location,
            startDateTime = @startDateTime,
            endDateTime = @endDateTime,
            isCompanyWide = @isCompanyWide,
            updatedAt = SYSUTCDATETIME()
        WHERE id = @id
      `);

    await new sql.Request(tx)
      .input('eventId', sql.Int, id)
      .query('DELETE FROM dbo.CorporateEventAreas WHERE eventId = @eventId');

    if (!data.isCompanyWide) {
      for (const areaId of data.areaIds) {
        await new sql.Request(tx).input('eventId', sql.Int, id).input('areaId', sql.Int, areaId)
          .query(`
            INSERT INTO dbo.CorporateEventAreas (eventId, areaId) VALUES (@eventId, @areaId)
          `);
      }
    }

    await tx.commit();
  } catch (error) {
    await tx.rollback();
    throw error;
  }
}

export async function setCorporateEventStatus(
  id: number,
  status: CorporateEventStatus,
  publishedAt?: Date | null,
): Promise<void> {
  const pool = getPool();
  const request = pool.request().input('id', sql.Int, id).input('status', sql.NVarChar(20), status);

  let publishedClause = '';
  if (publishedAt !== undefined) {
    request.input('publishedAt', sql.DateTime2, publishedAt);
    publishedClause = ', publishedAt = @publishedAt';
  }

  await request.query(`
    UPDATE dbo.CorporateEvents
    SET status = @status, updatedAt = SYSUTCDATETIME()${publishedClause}
    WHERE id = @id
  `);
}
