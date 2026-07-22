import sql from 'mssql';
import { getPool } from '../config/database';

function bindIntList(request: sql.Request, prefix: string, ids: number[]): string[] {
  return ids.map((id, i) => {
    request.input(`${prefix}${i}`, sql.Int, id);
    return `@${prefix}${i}`;
  });
}

export async function findPrimaryAreaManager(
  areaId: number,
): Promise<{ id: number; fullName: string } | null> {
  const pool = getPool();
  const result = await pool.request().input('areaId', sql.Int, areaId).query<{
    id: number;
    fullName: string;
  }>(`
    SELECT TOP 1 u.id, CONCAT(u.firstName, N' ', u.lastName) AS fullName
    FROM dbo.AreaLeaders al
    INNER JOIN dbo.Users u ON u.id = al.userId
    WHERE al.areaId = @areaId AND u.isActive = 1
    ORDER BY u.lastName, u.firstName
  `);
  return result.recordset[0] ?? null;
}

export async function getCollaboratorCounts(userId: number): Promise<{
  pendingTasks: number;
  activeRequests: number;
  upcomingMeetings: number;
  unreadNotifications: number;
}> {
  const pool = getPool();
  const result = await pool.request().input('userId', sql.Int, userId).query<{
    pendingTasks: number;
    activeRequests: number;
    upcomingMeetings: number;
    unreadNotifications: number;
  }>(`
    SELECT
      (SELECT COUNT(*)
       FROM dbo.TaskAssignees ta
       INNER JOIN dbo.Tasks t ON t.id = ta.taskId
       WHERE ta.userId = @userId AND t.archivedAt IS NULL AND t.status <> N'DONE') AS pendingTasks,
      (SELECT COUNT(*)
       FROM dbo.Requests
       WHERE requesterId = @userId AND status NOT IN (N'CLOSED', N'REJECTED')) AS activeRequests,
      (SELECT COUNT(*)
       FROM dbo.Meetings m
       WHERE m.status IN (N'SCHEDULED', N'RESCHEDULED')
         AND m.endDateTime >= SYSUTCDATETIME()
         AND m.startDateTime < DATEADD(day, 2, CAST(SYSUTCDATETIME() AS DATE))
         AND (m.organizerId = @userId OR EXISTS (
           SELECT 1 FROM dbo.MeetingAttendees ma
           WHERE ma.meetingId = m.id AND ma.userId = @userId
         ))) AS upcomingMeetings,
      (SELECT COUNT(*)
       FROM dbo.Notifications
       WHERE userId = @userId AND isRead = 0) AS unreadNotifications
  `);
  return (
    result.recordset[0] ?? {
      pendingTasks: 0,
      activeRequests: 0,
      upcomingMeetings: 0,
      unreadNotifications: 0,
    }
  );
}

export async function listUserTasksSummary(
  userId: number,
  limit = 8,
): Promise<
  {
    id: number;
    title: string;
    priority: string;
    status: string;
    dueDate: Date | null;
    boardId: number;
  }[]
> {
  const pool = getPool();
  const top = Math.min(Math.max(limit, 1), 20);
  const result = await pool.request().input('userId', sql.Int, userId).query<{
    id: number;
    title: string;
    priority: string;
    status: string;
    dueDate: Date | null;
    boardId: number;
  }>(`
    SELECT TOP (${top})
      t.id, t.title, t.priority, t.status, t.dueDate, t.boardId
    FROM dbo.TaskAssignees ta
    INNER JOIN dbo.Tasks t ON t.id = ta.taskId
    WHERE ta.userId = @userId AND t.archivedAt IS NULL
    ORDER BY
      CASE WHEN t.status = N'DONE' THEN 1 ELSE 0 END,
      CASE WHEN t.dueDate IS NULL THEN 1 ELSE 0 END,
      t.dueDate ASC,
      t.updatedAt DESC
  `);
  return result.recordset;
}

export async function listUserUpcomingMeetings(
  userId: number,
  limit = 5,
): Promise<
  {
    id: number;
    title: string;
    startDateTime: Date;
    endDateTime: Date;
    location: string | null;
    isToday: boolean;
  }[]
> {
  const pool = getPool();
  const top = Math.min(Math.max(limit, 1), 10);
  const result = await pool.request().input('userId', sql.Int, userId).query<{
    id: number;
    title: string;
    startDateTime: Date;
    endDateTime: Date;
    location: string | null;
    isToday: boolean;
  }>(`
    SELECT TOP (${top})
      m.id,
      m.title,
      m.startDateTime,
      m.endDateTime,
      m.location,
      CASE WHEN CAST(m.startDateTime AS DATE) = CAST(SYSUTCDATETIME() AS DATE) THEN 1 ELSE 0 END AS isToday
    FROM dbo.Meetings m
    WHERE m.status IN (N'SCHEDULED', N'RESCHEDULED')
      AND m.endDateTime >= SYSUTCDATETIME()
      AND (m.organizerId = @userId OR EXISTS (
        SELECT 1 FROM dbo.MeetingAttendees ma
        WHERE ma.meetingId = m.id AND ma.userId = @userId
      ))
    ORDER BY m.startDateTime ASC
  `);
  return result.recordset;
}

export async function listRecentNotifications(
  userId: number,
  limit = 5,
): Promise<
  {
    id: number;
    title: string;
    message: string;
    createdAt: Date;
    isRead: boolean;
  }[]
> {
  const pool = getPool();
  const top = Math.min(Math.max(limit, 1), 10);
  const result = await pool.request().input('userId', sql.Int, userId).query<{
    id: number;
    title: string;
    message: string;
    createdAt: Date;
    isRead: boolean;
  }>(`
    SELECT TOP (${top}) id, title, message, createdAt, isRead
    FROM dbo.Notifications
    WHERE userId = @userId
    ORDER BY createdAt DESC
  `);
  return result.recordset.map((r) => ({ ...r, isRead: Boolean(r.isRead) }));
}

export async function getTeamTaskAggregates(boardIds: number[]): Promise<{
  activeTasks: number;
  completed7Days: number;
  completed30Days: number;
  overdueTasks: number;
}> {
  if (boardIds.length === 0) {
    return { activeTasks: 0, completed7Days: 0, completed30Days: 0, overdueTasks: 0 };
  }
  const pool = getPool();
  const request = pool.request();
  const placeholders = bindIntList(request, 'boardId', boardIds);
  const result = await request.query<{
    activeTasks: number;
    completed7Days: number;
    completed30Days: number;
    overdueTasks: number;
  }>(`
    SELECT
      SUM(CASE WHEN status <> N'DONE' AND archivedAt IS NULL THEN 1 ELSE 0 END) AS activeTasks,
      SUM(CASE WHEN status = N'DONE' AND completedAt >= DATEADD(day, -7, SYSUTCDATETIME()) THEN 1 ELSE 0 END) AS completed7Days,
      SUM(CASE WHEN status = N'DONE' AND completedAt >= DATEADD(day, -30, SYSUTCDATETIME()) THEN 1 ELSE 0 END) AS completed30Days,
      SUM(CASE WHEN status <> N'DONE' AND archivedAt IS NULL
        AND dueDate IS NOT NULL AND dueDate < CAST(SYSUTCDATETIME() AS DATE) THEN 1 ELSE 0 END) AS overdueTasks
    FROM dbo.Tasks
    WHERE boardId IN (${placeholders.join(', ')})
  `);
  return (
    result.recordset[0] ?? {
      activeTasks: 0,
      completed7Days: 0,
      completed30Days: 0,
      overdueTasks: 0,
    }
  );
}

export async function getTasksByStatusForBoards(
  boardIds: number[],
): Promise<{ status: string; count: number }[]> {
  if (boardIds.length === 0) return [];
  const pool = getPool();
  const request = pool.request();
  const placeholders = bindIntList(request, 'boardId', boardIds);
  const result = await request.query<{ status: string; count: number }>(`
    SELECT status, COUNT(*) AS count
    FROM dbo.Tasks
    WHERE boardId IN (${placeholders.join(', ')}) AND archivedAt IS NULL
    GROUP BY status
    ORDER BY count DESC
  `);
  return result.recordset;
}

export async function getTopTaskCompleters(
  boardIds: number[],
  days = 30,
  limit = 5,
): Promise<{ userId: number; name: string; completedCount: number }[]> {
  if (boardIds.length === 0) return [];
  const pool = getPool();
  const request = pool.request().input('days', sql.Int, days);
  const placeholders = bindIntList(request, 'boardId', boardIds);
  const top = Math.min(Math.max(limit, 1), 10);
  const result = await request.query<{ userId: number; name: string; completedCount: number }>(`
    SELECT TOP (${top})
      ta.userId,
      CONCAT(u.firstName, N' ', u.lastName) AS name,
      COUNT(*) AS completedCount
    FROM dbo.TaskAssignees ta
    INNER JOIN dbo.Tasks t ON t.id = ta.taskId
    INNER JOIN dbo.Users u ON u.id = ta.userId
    WHERE t.boardId IN (${placeholders.join(', ')})
      AND t.status = N'DONE'
      AND t.completedAt >= DATEADD(day, -@days, SYSUTCDATETIME())
    GROUP BY ta.userId, u.firstName, u.lastName
    ORDER BY completedCount DESC, name ASC
  `);
  return result.recordset;
}

export async function getOverdueTasksByUser(
  boardIds: number[],
  limit = 5,
): Promise<{ userId: number; name: string; overdueCount: number }[]> {
  if (boardIds.length === 0) return [];
  const pool = getPool();
  const request = pool.request();
  const placeholders = bindIntList(request, 'boardId', boardIds);
  const top = Math.min(Math.max(limit, 1), 10);
  const result = await request.query<{ userId: number; name: string; overdueCount: number }>(`
    SELECT TOP (${top})
      ta.userId,
      CONCAT(u.firstName, N' ', u.lastName) AS name,
      COUNT(*) AS overdueCount
    FROM dbo.TaskAssignees ta
    INNER JOIN dbo.Tasks t ON t.id = ta.taskId
    INNER JOIN dbo.Users u ON u.id = ta.userId
    WHERE t.boardId IN (${placeholders.join(', ')})
      AND t.archivedAt IS NULL AND t.status <> N'DONE'
      AND t.dueDate IS NOT NULL AND t.dueDate < CAST(SYSUTCDATETIME() AS DATE)
    GROUP BY ta.userId, u.firstName, u.lastName
    ORDER BY overdueCount DESC, name ASC
  `);
  return result.recordset;
}

export async function countDocumentsUploadedByAreas(areaIds: number[], days = 30): Promise<number> {
  if (areaIds.length === 0) return 0;
  const pool = getPool();
  const request = pool.request().input('days', sql.Int, days);
  const placeholders = bindIntList(request, 'areaId', areaIds);
  const result = await request.query<{ cnt: number }>(`
    SELECT COUNT(*) AS cnt
    FROM dbo.Documents d
    INNER JOIN dbo.Folders f ON f.id = d.folderId
    WHERE f.areaId IN (${placeholders.join(', ')})
      AND d.createdAt >= DATEADD(day, -@days, SYSUTCDATETIME())
  `);
  return result.recordset[0]?.cnt ?? 0;
}

export async function countRequestsByStatusForAreas(
  areaIds: number[],
): Promise<{ status: string; count: number }[]> {
  if (areaIds.length === 0) return [];
  const pool = getPool();
  const request = pool.request();
  const placeholders = bindIntList(request, 'areaId', areaIds);
  const result = await request.query<{ status: string; count: number }>(`
    SELECT status, COUNT(*) AS count
    FROM dbo.Requests
    WHERE targetAreaId IN (${placeholders.join(', ')})
    GROUP BY status
    ORDER BY count DESC
  `);
  return result.recordset;
}

export async function getTicketExtendedMetrics(): Promise<{
  openCount: number;
  inProgressCount: number;
  criticalCount: number;
  avgResolutionHours: number | null;
  resolvedLast7Days: number;
}> {
  const pool = getPool();
  const result = await pool.request().query<{
    openCount: number;
    inProgressCount: number;
    criticalCount: number;
    avgResolutionHours: number | null;
    resolvedLast7Days: number;
  }>(`
    SELECT
      SUM(CASE WHEN status = N'OPEN' THEN 1 ELSE 0 END) AS openCount,
      SUM(CASE WHEN status = N'IN_PROGRESS' THEN 1 ELSE 0 END) AS inProgressCount,
      SUM(CASE WHEN priority = N'Critical' AND status NOT IN (N'CLOSED', N'RESOLVED') THEN 1 ELSE 0 END) AS criticalCount,
      AVG(CASE WHEN resolvedAt IS NOT NULL THEN DATEDIFF(MINUTE, createdAt, resolvedAt) / 60.0 END) AS avgResolutionHours,
      SUM(CASE WHEN resolvedAt >= DATEADD(day, -7, SYSUTCDATETIME()) THEN 1 ELSE 0 END) AS resolvedLast7Days
    FROM dbo.Tickets
  `);
  return (
    result.recordset[0] ?? {
      openCount: 0,
      inProgressCount: 0,
      criticalCount: 0,
      avgResolutionHours: null,
      resolvedLast7Days: 0,
    }
  );
}

export async function listLowStockConsumables(
  limit = 8,
): Promise<{ id: number; name: string; currentStock: number; minimumStock: number }[]> {
  const pool = getPool();
  const top = Math.min(Math.max(limit, 1), 20);
  const result = await pool.request().query<{
    id: number;
    name: string;
    currentStock: number;
    minimumStock: number;
  }>(`
    SELECT TOP (${top}) id, name, currentStock, minimumStock
    FROM dbo.Consumables
    WHERE currentStock <= minimumStock
    ORDER BY currentStock ASC, name ASC
  `);
  return result.recordset;
}

export async function listMaintenanceAssets(
  limit = 8,
): Promise<{ id: number; code: string; name: string }[]> {
  const pool = getPool();
  const top = Math.min(Math.max(limit, 1), 20);
  const result = await pool.request().query<{ id: number; code: string; name: string }>(`
    SELECT TOP (${top}) id, code, name
    FROM dbo.Assets
    WHERE status = N'IN_MAINTENANCE'
    ORDER BY updatedAt DESC
  `);
  return result.recordset;
}

export async function getAdminGlobalKpis(): Promise<{
  activeUsers: number;
  totalDocuments: number;
  totalTasks: number;
  totalTickets: number;
  totalRequests: number;
}> {
  const pool = getPool();
  const result = await pool.request().query<{
    activeUsers: number;
    totalDocuments: number;
    totalTasks: number;
    totalTickets: number;
    totalRequests: number;
  }>(`
    SELECT
      (SELECT COUNT(*) FROM dbo.Users WHERE isActive = 1) AS activeUsers,
      (SELECT COUNT(*) FROM dbo.Documents) AS totalDocuments,
      (SELECT COUNT(*) FROM dbo.Tasks WHERE archivedAt IS NULL) AS totalTasks,
      (SELECT COUNT(*) FROM dbo.Tickets) AS totalTickets,
      (SELECT COUNT(*) FROM dbo.Requests) AS totalRequests
  `);
  return (
    result.recordset[0] ?? {
      activeUsers: 0,
      totalDocuments: 0,
      totalTasks: 0,
      totalTickets: 0,
      totalRequests: 0,
    }
  );
}

export async function getModuleUsageLast30Days(): Promise<{
  documents: number;
  learning: number;
  chat: number;
  serviceDesk: number;
}> {
  const pool = getPool();
  const result = await pool.request().query<{
    documents: number;
    learning: number;
    chat: number;
    serviceDesk: number;
  }>(`
    SELECT
      (SELECT COUNT(*) FROM dbo.Documents WHERE createdAt >= DATEADD(day, -30, SYSUTCDATETIME())) AS documents,
      (SELECT COUNT(*) FROM dbo.LearningUserProgress WHERE completedAt >= DATEADD(day, -30, SYSUTCDATETIME())) AS learning,
      (SELECT COUNT(*) FROM dbo.ChatMessages WHERE createdAt >= DATEADD(day, -30, SYSUTCDATETIME())) AS chat,
      (SELECT COUNT(*) FROM dbo.Tickets WHERE createdAt >= DATEADD(day, -30, SYSUTCDATETIME())) AS serviceDesk
  `);
  return result.recordset[0] ?? { documents: 0, learning: 0, chat: 0, serviceDesk: 0 };
}

export async function getMonthlyAuditActivity(
  months = 6,
): Promise<{ month: string; count: number }[]> {
  const pool = getPool();
  const result = await pool.request().input('months', sql.Int, months).query<{
    month: string;
    count: number;
  }>(`
    SELECT
      FORMAT(DATEFROMPARTS(YEAR(createdAt), MONTH(createdAt), 1), 'yyyy-MM') AS month,
      COUNT(*) AS count
    FROM dbo.AuditLogs
    WHERE createdAt >= DATEADD(month, -@months, SYSUTCDATETIME())
    GROUP BY YEAR(createdAt), MONTH(createdAt)
    ORDER BY YEAR(createdAt), MONTH(createdAt)
  `);
  return result.recordset;
}

export async function getTopActiveAreas(
  limit = 5,
): Promise<{ areaId: number; areaName: string; activityScore: number }[]> {
  const pool = getPool();
  const top = Math.min(Math.max(limit, 1), 10);
  const result = await pool.query<{ areaId: number; areaName: string; activityScore: number }>(`
    SELECT TOP (${top}) a.id AS areaId, a.name AS areaName,
      (
        ISNULL((SELECT COUNT(*) FROM dbo.Tasks t
          INNER JOIN dbo.Boards b ON b.id = t.boardId
          WHERE b.areaId = a.id AND t.updatedAt >= DATEADD(day, -30, SYSUTCDATETIME())), 0)
        + ISNULL((SELECT COUNT(*) FROM dbo.Documents d
          INNER JOIN dbo.Folders f ON f.id = d.folderId
          WHERE f.areaId = a.id AND d.createdAt >= DATEADD(day, -30, SYSUTCDATETIME())), 0)
        + ISNULL((SELECT COUNT(*) FROM dbo.Requests r
          WHERE r.targetAreaId = a.id AND r.createdAt >= DATEADD(day, -30, SYSUTCDATETIME())), 0)
      ) AS activityScore
    FROM dbo.Areas a
    WHERE a.isActive = 1
    ORDER BY activityScore DESC, a.name ASC
  `);
  return result.recordset;
}

export async function getBusiestAreaByOpenTasks(): Promise<{
  areaId: number;
  areaName: string;
  openTasks: number;
} | null> {
  const pool = getPool();
  const result = await pool.query<{ areaId: number; areaName: string; openTasks: number }>(`
    SELECT TOP 1 a.id AS areaId, a.name AS areaName, COUNT(t.id) AS openTasks
    FROM dbo.Areas a
    INNER JOIN dbo.Boards b ON b.areaId = a.id
    INNER JOIN dbo.Tasks t ON t.boardId = b.id
    WHERE a.isActive = 1 AND t.archivedAt IS NULL AND t.status <> N'DONE'
    GROUP BY a.id, a.name
    ORDER BY openTasks DESC
  `);
  return result.recordset[0] ?? null;
}

export async function listRecentAuditLogs(limit = 8): Promise<
  {
    id: number;
    action: string;
    actorName: string | null;
    createdAt: Date;
  }[]
> {
  const pool = getPool();
  const top = Math.min(Math.max(limit, 1), 20);
  const result = await pool.request().query<{
    id: number;
    action: string;
    actorName: string | null;
    createdAt: Date;
  }>(`
    SELECT TOP (${top})
      al.id,
      al.action,
      CONCAT(u.firstName, N' ', u.lastName) AS actorName,
      al.createdAt
    FROM dbo.AuditLogs al
    LEFT JOIN dbo.Users u ON u.id = al.actorUserId
    ORDER BY al.createdAt DESC
  `);
  return result.recordset;
}

export async function getActiveTasksByAssigneeForBoards(
  boardIds: number[],
  limit = 8,
): Promise<{ userId: number; name: string; count: number }[]> {
  if (boardIds.length === 0) return [];
  const pool = getPool();
  const request = pool.request();
  const placeholders = bindIntList(request, 'boardId', boardIds);
  const top = Math.min(Math.max(limit, 1), 15);
  const result = await request.query<{ userId: number; name: string; count: number }>(`
    SELECT TOP (${top})
      ta.userId,
      CONCAT(u.firstName, N' ', u.lastName) AS name,
      COUNT(*) AS count
    FROM dbo.TaskAssignees ta
    INNER JOIN dbo.Tasks t ON t.id = ta.taskId
    INNER JOIN dbo.Users u ON u.id = ta.userId
    WHERE t.boardId IN (${placeholders.join(', ')})
      AND t.archivedAt IS NULL AND t.status <> N'DONE'
    GROUP BY ta.userId, u.firstName, u.lastName
    ORDER BY count DESC, name ASC
  `);
  return result.recordset;
}
