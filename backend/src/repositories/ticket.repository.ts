import sql from 'mssql';
import type { TicketPriority } from '../constants/ticket-priority';
import type { TicketStatus } from '../constants/ticket-status';
import { getPool } from '../config/database';

export interface TicketRow {
  id: number;
  code: string;
  requesterId: number;
  requesterFirstName: string;
  requesterLastName: string;
  requesterAreaName: string;
  assignedTo: number | null;
  assigneeFirstName: string | null;
  assigneeLastName: string | null;
  title: string;
  description: string;
  categoryId: number;
  categoryName: string;
  priority: TicketPriority;
  status: TicketStatus;
  createdAt: Date;
  updatedAt: Date;
  resolvedAt: Date | null;
  closedAt: Date | null;
}

export interface TicketCommentRow {
  id: number;
  ticketId: number;
  userId: number;
  authorFirstName: string;
  authorLastName: string;
  authorAreaName: string;
  authorAreaIsItSupport: boolean;
  message: string;
  createdAt: Date;
}

export interface TicketListFilters {
  requesterId?: number;
  status?: TicketStatus;
  priority?: TicketPriority;
  categoryId?: number;
  assignedTo?: number;
  search?: string;
  activeOnly?: boolean;
}

const TICKET_SELECT = `
  t.id,
  t.code,
  t.requesterId,
  req.firstName AS requesterFirstName,
  req.lastName AS requesterLastName,
  ra.name AS requesterAreaName,
  t.assignedTo,
  asn.firstName AS assigneeFirstName,
  asn.lastName AS assigneeLastName,
  t.title,
  t.description,
  t.categoryId,
  tc.name AS categoryName,
  t.priority,
  t.status,
  t.createdAt,
  t.updatedAt,
  t.resolvedAt,
  t.closedAt
`;

const TICKET_FROM = `
  FROM dbo.Tickets t
  INNER JOIN dbo.TicketCategories tc ON t.categoryId = tc.id
  INNER JOIN dbo.Users req ON t.requesterId = req.id
  INNER JOIN dbo.Areas ra ON req.areaId = ra.id
  LEFT JOIN dbo.Users asn ON t.assignedTo = asn.id
`;

export async function allocateTicketCode(): Promise<string> {
  const pool = getPool();
  const result = await pool.request().query<{ nextNum: number }>(`
    SELECT ISNULL(MAX(TRY_CAST(SUBSTRING(code, 4, 20) AS INT)), 0) + 1 AS nextNum
    FROM dbo.Tickets
    WHERE code LIKE N'TI-%'
  `);
  const nextNum = result.recordset[0]?.nextNum ?? 1;
  return `TI-${String(nextNum).padStart(4, '0')}`;
}

export async function createTicket(input: {
  code: string;
  requesterId: number;
  title: string;
  description: string;
  categoryId: number;
  priority: TicketPriority;
}): Promise<number> {
  const pool = getPool();
  const result = await pool
    .request()
    .input('code', sql.NVarChar(20), input.code)
    .input('requesterId', sql.Int, input.requesterId)
    .input('title', sql.NVarChar(255), input.title)
    .input('description', sql.NVarChar(sql.MAX), input.description)
    .input('categoryId', sql.Int, input.categoryId)
    .input('priority', sql.NVarChar(20), input.priority).query<{ id: number }>(`
      INSERT INTO dbo.Tickets (
        code, requesterId, title, description, categoryId, priority, status
      )
      OUTPUT INSERTED.id
      VALUES (
        @code, @requesterId, @title, @description, @categoryId, @priority, N'OPEN'
      )
    `);
  return result.recordset[0]!.id;
}

export async function deleteTicket(id: number): Promise<void> {
  const pool = getPool();
  await pool.request().input('id', sql.Int, id).query(`
      DELETE FROM dbo.Tickets WHERE id = @id
    `);
}

function buildTicketWhere(filters: TicketListFilters): {
  clause: string;
  request: sql.Request;
} {
  const pool = getPool();
  const request = pool.request();
  const conditions: string[] = ['1 = 1'];

  if (filters.requesterId != null) {
    request.input('requesterId', sql.Int, filters.requesterId);
    conditions.push('t.requesterId = @requesterId');
  }

  if (filters.status) {
    request.input('status', sql.NVarChar(20), filters.status);
    conditions.push('t.status = @status');
  }

  if (filters.priority) {
    request.input('priority', sql.NVarChar(20), filters.priority);
    conditions.push('t.priority = @priority');
  }

  if (filters.categoryId != null) {
    request.input('categoryId', sql.Int, filters.categoryId);
    conditions.push('t.categoryId = @categoryId');
  }

  if (filters.assignedTo != null) {
    request.input('assignedTo', sql.Int, filters.assignedTo);
    conditions.push('t.assignedTo = @assignedTo');
  }

  if (filters.activeOnly) {
    conditions.push(`t.status NOT IN (N'RESOLVED', N'CLOSED')`);
  }

  if (filters.search?.trim()) {
    request.input('search', sql.NVarChar(255), `%${filters.search.trim()}%`);
    conditions.push(
      '(t.code LIKE @search OR t.title LIKE @search OR req.firstName LIKE @search OR req.lastName LIKE @search)',
    );
  }

  return { clause: conditions.join(' AND '), request };
}

export async function listTickets(filters: TicketListFilters): Promise<TicketRow[]> {
  const { clause, request } = buildTicketWhere(filters);
  const result = await request.query<TicketRow>(`
    SELECT ${TICKET_SELECT}
    ${TICKET_FROM}
    WHERE ${clause}
    ORDER BY
      CASE t.priority
        WHEN N'Critical' THEN 1
        WHEN N'High' THEN 2
        WHEN N'Medium' THEN 3
        ELSE 4
      END,
      t.createdAt DESC
  `);
  return result.recordset;
}

export async function findTicketById(id: number): Promise<TicketRow | null> {
  const pool = getPool();
  const result = await pool.request().input('id', sql.Int, id).query<TicketRow>(`
    SELECT ${TICKET_SELECT}
    ${TICKET_FROM}
    WHERE t.id = @id
  `);
  return result.recordset[0] ?? null;
}

export async function updateTicketAssignment(id: number, assignedTo: number | null): Promise<void> {
  const pool = getPool();
  await pool.request().input('id', sql.Int, id).input('assignedTo', sql.Int, assignedTo).query(`
      UPDATE dbo.Tickets
      SET assignedTo = @assignedTo, updatedAt = SYSUTCDATETIME()
      WHERE id = @id
    `);
}

export async function updateTicketStatus(
  id: number,
  status: TicketStatus,
  timestamps: { resolvedAt?: Date | null; closedAt?: Date | null },
): Promise<void> {
  const pool = getPool();
  const request = pool.request().input('id', sql.Int, id).input('status', sql.NVarChar(20), status);

  const sets = ['status = @status', 'updatedAt = SYSUTCDATETIME()'];

  if (timestamps.resolvedAt !== undefined) {
    request.input('resolvedAt', sql.DateTime2, timestamps.resolvedAt);
    sets.push('resolvedAt = @resolvedAt');
  }
  if (timestamps.closedAt !== undefined) {
    request.input('closedAt', sql.DateTime2, timestamps.closedAt);
    sets.push('closedAt = @closedAt');
  }

  await request.query(`
    UPDATE dbo.Tickets
    SET ${sets.join(', ')}
    WHERE id = @id
  `);
}

export async function touchTicketUpdated(id: number): Promise<void> {
  const pool = getPool();
  await pool.request().input('id', sql.Int, id).query(`
    UPDATE dbo.Tickets SET updatedAt = SYSUTCDATETIME() WHERE id = @id
  `);
}

export async function updateTicketPriority(id: number, priority: TicketPriority): Promise<void> {
  const pool = getPool();
  await pool.request().input('id', sql.Int, id).input('priority', sql.NVarChar(20), priority)
    .query(`
      UPDATE dbo.Tickets
      SET priority = @priority, updatedAt = SYSUTCDATETIME()
      WHERE id = @id
    `);
}

export async function listTicketComments(ticketId: number): Promise<TicketCommentRow[]> {
  const pool = getPool();
  const result = await pool.request().input('ticketId', sql.Int, ticketId).query<TicketCommentRow>(`
    SELECT
      c.id,
      c.ticketId,
      c.userId,
      u.firstName AS authorFirstName,
      u.lastName AS authorLastName,
      a.name AS authorAreaName,
      CAST(a.isItSupportArea AS BIT) AS authorAreaIsItSupport,
      c.message,
      c.createdAt
    FROM dbo.TicketComments c
    INNER JOIN dbo.Users u ON c.userId = u.id
    INNER JOIN dbo.Areas a ON u.areaId = a.id
    WHERE c.ticketId = @ticketId
    ORDER BY c.createdAt ASC
  `);
  return result.recordset;
}

export async function insertTicketComment(
  ticketId: number,
  userId: number,
  message: string,
): Promise<number> {
  const pool = getPool();
  const result = await pool
    .request()
    .input('ticketId', sql.Int, ticketId)
    .input('userId', sql.Int, userId)
    .input('message', sql.NVarChar(sql.MAX), message).query<{ id: number }>(`
      INSERT INTO dbo.TicketComments (ticketId, userId, message)
      OUTPUT INSERTED.id
      VALUES (@ticketId, @userId, @message)
    `);
  return result.recordset[0]!.id;
}

export async function listItTeamUserIds(): Promise<
  { id: number; email: string; firstName: string; lastName: string }[]
> {
  const pool = getPool();
  const result = await pool.request().query<{
    id: number;
    email: string;
    firstName: string;
    lastName: string;
  }>(`
    SELECT u.id, u.email, u.firstName, u.lastName
    FROM dbo.Users u
    INNER JOIN dbo.Areas a ON u.areaId = a.id
    WHERE u.isActive = 1
      AND a.isActive = 1
      AND a.isItSupportArea = 1
  `);
  return result.recordset;
}

export async function findActiveUserInItAreas(userId: number): Promise<boolean> {
  const pool = getPool();
  const result = await pool.request().input('userId', sql.Int, userId).query<{ ok: number }>(`
    SELECT 1 AS ok
    FROM dbo.Users u
    INNER JOIN dbo.Areas a ON u.areaId = a.id
    WHERE u.id = @userId
      AND u.isActive = 1
      AND a.isActive = 1
      AND a.isItSupportArea = 1
  `);
  return (result.recordset[0]?.ok ?? 0) === 1;
}

export interface TicketMetricsRow {
  openCount: number;
  inProgressCount: number;
  avgResolutionHours: number | null;
}

export async function getTicketMetrics(): Promise<TicketMetricsRow> {
  const pool = getPool();
  const result = await pool.request().query<TicketMetricsRow>(`
    SELECT
      SUM(CASE WHEN status = N'OPEN' THEN 1 ELSE 0 END) AS openCount,
      SUM(CASE WHEN status = N'IN_PROGRESS' THEN 1 ELSE 0 END) AS inProgressCount,
      AVG(
        CASE
          WHEN resolvedAt IS NOT NULL
          THEN DATEDIFF(MINUTE, createdAt, resolvedAt) / 60.0
          ELSE NULL
        END
      ) AS avgResolutionHours
    FROM dbo.Tickets
    WHERE status <> N'CLOSED'
  `);
  return (
    result.recordset[0] ?? {
      openCount: 0,
      inProgressCount: 0,
      avgResolutionHours: null,
    }
  );
}

export async function countTicketsByCategory(): Promise<
  { categoryId: number; categoryName: string; count: number }[]
> {
  const pool = getPool();
  const result = await pool.request().query<{
    categoryId: number;
    categoryName: string;
    count: number;
  }>(`
    SELECT t.categoryId, tc.name AS categoryName, COUNT(*) AS count
    FROM dbo.Tickets t
    INNER JOIN dbo.TicketCategories tc ON t.categoryId = tc.id
    WHERE t.status NOT IN (N'CLOSED')
    GROUP BY t.categoryId, tc.name
    ORDER BY count DESC
  `);
  return result.recordset;
}
