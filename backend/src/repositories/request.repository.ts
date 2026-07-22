import sql from 'mssql';
import { getPool } from '../config/database';
import type { RequestPriority } from '../constants/request-priority';
import type { RequestStatus } from '../constants/request-status';

export interface RequestRow {
  id: number;
  code: string;
  requesterId: number;
  requesterFirstName: string;
  requesterLastName: string;
  requesterEmail: string;
  requesterAreaName: string;
  targetAreaId: number;
  targetAreaName: string;
  title: string;
  description: string;
  category: string | null;
  priority: RequestPriority;
  status: RequestStatus;
  rejectionReason: string | null;
  linkedTaskId: number | null;
  linkedTaskTitle: string | null;
  linkedTaskBoardId: number | null;
  createdAt: Date;
  updatedAt: Date;
  resolvedAt: Date | null;
  closedAt: Date | null;
}

export interface RequestStatusHistoryRow {
  id: number;
  requestId: number;
  changedBy: number;
  changerFirstName: string;
  changerLastName: string;
  fromStatus: RequestStatus | null;
  toStatus: RequestStatus;
  comment: string | null;
  createdAt: Date;
}

export interface RequestListFilters {
  requesterId?: number;
  targetAreaId?: number;
  targetAreaIds?: number[];
  status?: RequestStatus;
  priority?: RequestPriority;
  fromDate?: Date;
  toDate?: Date;
}

const REQUEST_SELECT = `
  r.id,
  r.code,
  r.requesterId,
  req.firstName AS requesterFirstName,
  req.lastName AS requesterLastName,
  req.email AS requesterEmail,
  ra.name AS requesterAreaName,
  r.targetAreaId,
  ta.name AS targetAreaName,
  r.title,
  r.description,
  r.category,
  r.priority,
  r.status,
  r.rejectionReason,
  r.linkedTaskId,
  lt.title AS linkedTaskTitle,
  lt.boardId AS linkedTaskBoardId,
  r.createdAt,
  r.updatedAt,
  r.resolvedAt,
  r.closedAt
`;

const REQUEST_FROM = `
  FROM dbo.Requests r
  INNER JOIN dbo.Users req ON r.requesterId = req.id
  INNER JOIN dbo.Areas ra ON req.areaId = ra.id
  INNER JOIN dbo.Areas ta ON r.targetAreaId = ta.id
  LEFT JOIN dbo.Tasks lt ON r.linkedTaskId = lt.id
`;

export async function allocateRequestCode(): Promise<string> {
  const pool = getPool();
  const result = await pool.request().query<{ nextNum: number }>(`
    SELECT ISNULL(MAX(TRY_CAST(SUBSTRING(code, 5, 20) AS INT)), 0) + 1 AS nextNum
    FROM dbo.Requests
    WHERE code LIKE N'SOL-%'
  `);
  const nextNum = result.recordset[0]?.nextNum ?? 1;
  return `SOL-${String(nextNum).padStart(4, '0')}`;
}

export async function createRequest(input: {
  code: string;
  requesterId: number;
  targetAreaId: number;
  title: string;
  description: string;
  category: string | null;
  priority: RequestPriority;
}): Promise<number> {
  const pool = getPool();
  const result = await pool
    .request()
    .input('code', sql.NVarChar(20), input.code)
    .input('requesterId', sql.Int, input.requesterId)
    .input('targetAreaId', sql.Int, input.targetAreaId)
    .input('title', sql.NVarChar(300), input.title)
    .input('description', sql.NVarChar(sql.MAX), input.description)
    .input('category', sql.NVarChar(100), input.category)
    .input('priority', sql.NVarChar(20), input.priority).query<{ id: number }>(`
      INSERT INTO dbo.Requests (
        code, requesterId, targetAreaId, title, description, category, priority, status
      )
      OUTPUT INSERTED.id
      VALUES (
        @code, @requesterId, @targetAreaId, @title, @description, @category, @priority, N'SUBMITTED'
      )
    `);
  return result.recordset[0]!.id;
}

export async function insertRequestStatusHistory(input: {
  requestId: number;
  changedBy: number;
  fromStatus: RequestStatus | null;
  toStatus: RequestStatus;
  comment: string | null;
}): Promise<void> {
  const pool = getPool();
  await pool
    .request()
    .input('requestId', sql.Int, input.requestId)
    .input('changedBy', sql.Int, input.changedBy)
    .input('fromStatus', sql.NVarChar(20), input.fromStatus)
    .input('toStatus', sql.NVarChar(20), input.toStatus)
    .input('comment', sql.NVarChar(500), input.comment).query(`
      INSERT INTO dbo.RequestStatusHistory (requestId, changedBy, fromStatus, toStatus, comment)
      VALUES (@requestId, @changedBy, @fromStatus, @toStatus, @comment)
    `);
}

export async function findRequestById(id: number): Promise<RequestRow | null> {
  const pool = getPool();
  const result = await pool.request().input('id', sql.Int, id).query<RequestRow>(`
    SELECT ${REQUEST_SELECT}
    ${REQUEST_FROM}
    WHERE r.id = @id
  `);
  return result.recordset[0] ?? null;
}

function buildListQuery(filters: RequestListFilters): {
  conditions: string[];
  request: sql.Request;
} {
  const pool = getPool();
  const request = pool.request();
  const conditions: string[] = ['1 = 1'];

  if (filters.requesterId != null) {
    request.input('requesterId', sql.Int, filters.requesterId);
    conditions.push('r.requesterId = @requesterId');
  }
  if (filters.targetAreaId != null) {
    request.input('targetAreaId', sql.Int, filters.targetAreaId);
    conditions.push('r.targetAreaId = @targetAreaId');
  }
  if (filters.targetAreaIds != null && filters.targetAreaIds.length > 0) {
    const placeholders = filters.targetAreaIds.map((id, i) => {
      request.input(`areaId${i}`, sql.Int, id);
      return `@areaId${i}`;
    });
    conditions.push(`r.targetAreaId IN (${placeholders.join(', ')})`);
  }
  if (filters.status != null) {
    request.input('status', sql.NVarChar(20), filters.status);
    conditions.push('r.status = @status');
  }
  if (filters.priority != null) {
    request.input('priority', sql.NVarChar(20), filters.priority);
    conditions.push('r.priority = @priority');
  }
  if (filters.fromDate != null) {
    request.input('fromDate', sql.DateTime2, filters.fromDate);
    conditions.push('r.createdAt >= @fromDate');
  }
  if (filters.toDate != null) {
    request.input('toDate', sql.DateTime2, filters.toDate);
    conditions.push('r.createdAt <= @toDate');
  }

  return { conditions, request };
}

export async function listRequests(filters: RequestListFilters): Promise<RequestRow[]> {
  const { conditions, request } = buildListQuery(filters);
  const result = await request.query<RequestRow>(`
    SELECT ${REQUEST_SELECT}
    ${REQUEST_FROM}
    WHERE ${conditions.join(' AND ')}
    ORDER BY r.createdAt DESC
  `);
  return result.recordset;
}

export async function countSubmittedInAreas(areaIds: number[]): Promise<number> {
  if (areaIds.length === 0) return 0;
  const pool = getPool();
  const req = pool.request();
  const placeholders = areaIds.map((id, i) => {
    req.input(`areaId${i}`, sql.Int, id);
    return `@areaId${i}`;
  });
  const result = await req.query<{ cnt: number }>(`
    SELECT COUNT(*) AS cnt
    FROM dbo.Requests
    WHERE status = N'SUBMITTED' AND targetAreaId IN (${placeholders.join(', ')})
  `);
  return result.recordset[0]?.cnt ?? 0;
}

export async function updateRequestStatus(
  id: number,
  status: RequestStatus,
  extra: { rejectionReason?: string | null; resolvedAt?: Date | null; closedAt?: Date | null },
): Promise<void> {
  const pool = getPool();
  const req = pool.request().input('id', sql.Int, id).input('status', sql.NVarChar(20), status);

  const sets = ['status = @status', 'updatedAt = SYSUTCDATETIME()'];

  if (extra.rejectionReason !== undefined) {
    req.input('rejectionReason', sql.NVarChar(500), extra.rejectionReason);
    sets.push('rejectionReason = @rejectionReason');
  }
  if (extra.resolvedAt !== undefined) {
    req.input('resolvedAt', sql.DateTime2, extra.resolvedAt);
    sets.push('resolvedAt = @resolvedAt');
  }
  if (extra.closedAt !== undefined) {
    req.input('closedAt', sql.DateTime2, extra.closedAt);
    sets.push('closedAt = @closedAt');
  }

  await req.query(`UPDATE dbo.Requests SET ${sets.join(', ')} WHERE id = @id`);
}

export async function linkRequestTask(id: number, linkedTaskId: number): Promise<void> {
  const pool = getPool();
  await pool.request().input('id', sql.Int, id).input('linkedTaskId', sql.Int, linkedTaskId).query(`
      UPDATE dbo.Requests
      SET linkedTaskId = @linkedTaskId, updatedAt = SYSUTCDATETIME()
      WHERE id = @id
    `);
}

export async function listRequestStatusHistory(
  requestId: number,
): Promise<RequestStatusHistoryRow[]> {
  const pool = getPool();
  const result = await pool.request().input('requestId', sql.Int, requestId)
    .query<RequestStatusHistoryRow>(`
    SELECT
      h.id,
      h.requestId,
      h.changedBy,
      u.firstName AS changerFirstName,
      u.lastName AS changerLastName,
      h.fromStatus,
      h.toStatus,
      h.comment,
      h.createdAt
    FROM dbo.RequestStatusHistory h
    INNER JOIN dbo.Users u ON h.changedBy = u.id
    WHERE h.requestId = @requestId
    ORDER BY h.createdAt ASC, h.id ASC
  `);
  return result.recordset;
}
