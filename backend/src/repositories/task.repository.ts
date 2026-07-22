import sql from 'mssql';
import { getPool } from '../config/database';
import type { TaskPriority } from '../constants/task-priority';
import type { TaskStatus } from '../constants/task-status';
import type { TaskActivityAction } from '../constants/task-activity-action';
import { listColumnsByBoardId } from './board.repository';

export interface TaskRow {
  id: number;
  boardId: number;
  columnId: number;
  title: string;
  description: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  color: string | null;
  dueDate: Date | null;
  createdBy: number;
  creatorFirstName: string;
  creatorLastName: string;
  createdAt: Date;
  updatedAt: Date;
  archivedAt: Date | null;
  completedAt: Date | null;
  order: number;
  attachmentCount: number;
}

export interface TaskAssigneeRow {
  userId: number;
  firstName: string;
  lastName: string;
  areaName: string;
}

export interface TaskTagRow {
  tagId: number;
  tagName: string;
}

export interface TaskCommentRow {
  id: number;
  taskId: number;
  userId: number;
  authorFirstName: string;
  authorLastName: string;
  authorAreaName: string;
  message: string;
  createdAt: Date;
}

export interface TaskAttachmentRow {
  id: number;
  taskId: number;
  uploadedBy: number;
  uploaderFirstName: string;
  uploaderLastName: string;
  fileName: string;
  fileKey: string;
  fileType: string;
  fileSize: number;
  createdAt: Date;
}

export interface TaskActivityRow {
  id: number;
  taskId: number;
  userId: number;
  authorFirstName: string;
  authorLastName: string;
  action: TaskActivityAction;
  metadata: string | null;
  createdAt: Date;
}

const TASK_SELECT = `
  t.id, t.boardId, t.columnId, t.title, t.description, t.priority, t.status,
  t.color, t.dueDate, t.createdBy, u.firstName AS creatorFirstName,
  u.lastName AS creatorLastName, t.createdAt, t.updatedAt, t.archivedAt,
  t.completedAt, t.[order],
  (SELECT COUNT(*) FROM dbo.TaskAttachments ta WHERE ta.taskId = t.id) AS attachmentCount
`;

const TASK_FROM = `
  FROM dbo.Tasks t
  INNER JOIN dbo.Users u ON t.createdBy = u.id
`;

export async function listTasksByBoardId(
  boardId: number,
  includeArchived = false,
): Promise<TaskRow[]> {
  const pool = getPool();
  const archivedFilter = includeArchived ? '' : 'AND t.archivedAt IS NULL';
  const result = await pool.request().input('boardId', sql.Int, boardId).query<TaskRow>(`
    SELECT ${TASK_SELECT}
    ${TASK_FROM}
    WHERE t.boardId = @boardId ${archivedFilter}
    ORDER BY t.columnId, t.[order], t.id
  `);
  return result.recordset;
}

export async function findTaskById(taskId: number): Promise<TaskRow | null> {
  const pool = getPool();
  const result = await pool.request().input('id', sql.Int, taskId).query<TaskRow>(`
    SELECT ${TASK_SELECT}
    ${TASK_FROM}
    WHERE t.id = @id
  `);
  return result.recordset[0] ?? null;
}

export async function insertTask(data: {
  boardId: number;
  columnId: number;
  title: string;
  description: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  color: string | null;
  dueDate: Date | null;
  createdBy: number;
  order: number;
}): Promise<number> {
  const pool = getPool();
  const result = await pool
    .request()
    .input('boardId', sql.Int, data.boardId)
    .input('columnId', sql.Int, data.columnId)
    .input('title', sql.NVarChar(300), data.title)
    .input('description', sql.NVarChar(sql.MAX), data.description)
    .input('priority', sql.NVarChar(20), data.priority)
    .input('status', sql.NVarChar(20), data.status)
    .input('color', sql.NVarChar(7), data.color)
    .input('dueDate', sql.DateTime2, data.dueDate)
    .input('createdBy', sql.Int, data.createdBy)
    .input('order', sql.Int, data.order).query<{ id: number }>(`
      INSERT INTO dbo.Tasks (
        boardId, columnId, title, description, priority, status, color,
        dueDate, createdBy, [order]
      )
      OUTPUT INSERTED.id
      VALUES (
        @boardId, @columnId, @title, @description, @priority, @status, @color,
        @dueDate, @createdBy, @order
      )
    `);
  return result.recordset[0]!.id;
}

export async function updateTask(
  taskId: number,
  data: Partial<{
    title: string;
    description: string | null;
    priority: TaskPriority;
    color: string | null;
    dueDate: Date | null;
  }>,
): Promise<void> {
  const pool = getPool();
  const sets: string[] = ['updatedAt = SYSUTCDATETIME()'];
  const request = pool.request().input('id', sql.Int, taskId);
  if (data.title != null) {
    request.input('title', sql.NVarChar(300), data.title);
    sets.push('title = @title');
  }
  if (data.description !== undefined) {
    request.input('description', sql.NVarChar(sql.MAX), data.description);
    sets.push('description = @description');
  }
  if (data.priority != null) {
    request.input('priority', sql.NVarChar(20), data.priority);
    sets.push('priority = @priority');
  }
  if (data.color !== undefined) {
    request.input('color', sql.NVarChar(7), data.color);
    sets.push('color = @color');
  }
  if (data.dueDate !== undefined) {
    request.input('dueDate', sql.DateTime2, data.dueDate);
    sets.push('dueDate = @dueDate');
  }
  await request.query(`UPDATE dbo.Tasks SET ${sets.join(', ')} WHERE id = @id`);
}

export async function moveTask(
  taskId: number,
  columnId: number,
  status: TaskStatus,
  order: number,
  completedAt: Date | null,
): Promise<void> {
  const pool = getPool();
  await pool
    .request()
    .input('id', sql.Int, taskId)
    .input('columnId', sql.Int, columnId)
    .input('status', sql.NVarChar(20), status)
    .input('order', sql.Int, order)
    .input('completedAt', sql.DateTime2, completedAt).query(`
      UPDATE dbo.Tasks
      SET columnId = @columnId, status = @status, [order] = @order,
          completedAt = @completedAt, updatedAt = SYSUTCDATETIME()
      WHERE id = @id
    `);
}

export async function archiveTask(taskId: number): Promise<void> {
  const pool = getPool();
  await pool.request().input('id', sql.Int, taskId).query(`
    UPDATE dbo.Tasks
    SET status = N'ARCHIVED', archivedAt = SYSUTCDATETIME(), updatedAt = SYSUTCDATETIME()
    WHERE id = @id
  `);
}

export async function getMaxTaskOrderInColumn(columnId: number): Promise<number> {
  const pool = getPool();
  const result = await pool.request().input('columnId', sql.Int, columnId).query<{
    maxOrder: number | null;
  }>(`
    SELECT MAX([order]) AS maxOrder FROM dbo.Tasks
    WHERE columnId = @columnId AND archivedAt IS NULL
  `);
  return result.recordset[0]?.maxOrder ?? -1;
}

export async function reorderTasksInColumn(
  columnId: number,
  taskOrders: { taskId: number; order: number }[],
): Promise<void> {
  const pool = getPool();
  for (const item of taskOrders) {
    await pool
      .request()
      .input('columnId', sql.Int, columnId)
      .input('taskId', sql.Int, item.taskId)
      .input('order', sql.Int, item.order).query(`
        UPDATE dbo.Tasks SET [order] = @order, updatedAt = SYSUTCDATETIME()
        WHERE id = @taskId AND columnId = @columnId
      `);
  }
}

export async function listTaskAssignees(taskId: number): Promise<TaskAssigneeRow[]> {
  const pool = getPool();
  const result = await pool.request().input('taskId', sql.Int, taskId).query<TaskAssigneeRow>(`
    SELECT ta.userId, u.firstName, u.lastName, ar.name AS areaName
    FROM dbo.TaskAssignees ta
    INNER JOIN dbo.Users u ON ta.userId = u.id
    INNER JOIN dbo.Areas ar ON u.areaId = ar.id
    WHERE ta.taskId = @taskId
    ORDER BY u.lastName, u.firstName
  `);
  return result.recordset;
}

export async function setTaskAssignees(taskId: number, userIds: number[]): Promise<void> {
  const pool = getPool();
  await pool.request().input('taskId', sql.Int, taskId).query(`
    DELETE FROM dbo.TaskAssignees WHERE taskId = @taskId
  `);
  for (const userId of userIds) {
    await pool
      .request()
      .input('taskId', sql.Int, taskId)
      .input('userId', sql.Int, userId)
      .query(`INSERT INTO dbo.TaskAssignees (taskId, userId) VALUES (@taskId, @userId)`);
  }
}

export async function isUserAssignedToTask(taskId: number, userId: number): Promise<boolean> {
  const pool = getPool();
  const result = await pool
    .request()
    .input('taskId', sql.Int, taskId)
    .input('userId', sql.Int, userId).query<{ found: number }>(`
      SELECT 1 AS found FROM dbo.TaskAssignees WHERE taskId = @taskId AND userId = @userId
    `);
  return (result.recordset[0]?.found ?? 0) > 0;
}

export async function listTaskTags(taskId: number): Promise<TaskTagRow[]> {
  const pool = getPool();
  const result = await pool.request().input('taskId', sql.Int, taskId).query<TaskTagRow>(`
    SELECT tt.tagId, tg.name AS tagName
    FROM dbo.TaskTags tt
    INNER JOIN dbo.Tags tg ON tt.tagId = tg.id
    WHERE tt.taskId = @taskId
    ORDER BY tg.name
  `);
  return result.recordset;
}

export async function setTaskTags(taskId: number, tagIds: number[]): Promise<void> {
  const pool = getPool();
  await pool.request().input('taskId', sql.Int, taskId).query(`
    DELETE FROM dbo.TaskTags WHERE taskId = @taskId
  `);
  for (const tagId of tagIds) {
    await pool
      .request()
      .input('taskId', sql.Int, taskId)
      .input('tagId', sql.Int, tagId)
      .query(`INSERT INTO dbo.TaskTags (taskId, tagId) VALUES (@taskId, @tagId)`);
  }
}

export async function listTaskComments(taskId: number): Promise<TaskCommentRow[]> {
  const pool = getPool();
  const result = await pool.request().input('taskId', sql.Int, taskId).query<TaskCommentRow>(`
    SELECT c.id, c.taskId, c.userId, u.firstName AS authorFirstName,
           u.lastName AS authorLastName, ar.name AS authorAreaName,
           c.message, c.createdAt
    FROM dbo.TaskComments c
    INNER JOIN dbo.Users u ON c.userId = u.id
    INNER JOIN dbo.Areas ar ON u.areaId = ar.id
    WHERE c.taskId = @taskId
    ORDER BY c.createdAt
  `);
  return result.recordset;
}

export async function insertTaskComment(
  taskId: number,
  userId: number,
  message: string,
): Promise<number> {
  const pool = getPool();
  const result = await pool
    .request()
    .input('taskId', sql.Int, taskId)
    .input('userId', sql.Int, userId)
    .input('message', sql.NVarChar(sql.MAX), message).query<{ id: number }>(`
      INSERT INTO dbo.TaskComments (taskId, userId, message)
      OUTPUT INSERTED.id
      VALUES (@taskId, @userId, @message)
    `);
  return result.recordset[0]!.id;
}

export async function listTaskAttachments(taskId: number): Promise<TaskAttachmentRow[]> {
  const pool = getPool();
  const result = await pool.request().input('taskId', sql.Int, taskId).query<TaskAttachmentRow>(`
    SELECT a.id, a.taskId, a.uploadedBy, u.firstName AS uploaderFirstName,
           u.lastName AS uploaderLastName, a.fileName, a.fileKey, a.fileType,
           a.fileSize, a.createdAt
    FROM dbo.TaskAttachments a
    INNER JOIN dbo.Users u ON a.uploadedBy = u.id
    WHERE a.taskId = @taskId
    ORDER BY a.createdAt DESC
  `);
  return result.recordset;
}

export async function findTaskAttachmentById(
  attachmentId: number,
): Promise<TaskAttachmentRow | null> {
  const pool = getPool();
  const result = await pool.request().input('id', sql.Int, attachmentId).query<TaskAttachmentRow>(`
    SELECT a.id, a.taskId, a.uploadedBy, u.firstName AS uploaderFirstName,
           u.lastName AS uploaderLastName, a.fileName, a.fileKey, a.fileType,
           a.fileSize, a.createdAt
    FROM dbo.TaskAttachments a
    INNER JOIN dbo.Users u ON a.uploadedBy = u.id
    WHERE a.id = @id
  `);
  return result.recordset[0] ?? null;
}

export async function insertTaskAttachment(data: {
  taskId: number;
  uploadedBy: number;
  fileName: string;
  fileKey: string;
  fileType: string;
  fileSize: number;
}): Promise<number> {
  const pool = getPool();
  const result = await pool
    .request()
    .input('taskId', sql.Int, data.taskId)
    .input('uploadedBy', sql.Int, data.uploadedBy)
    .input('fileName', sql.NVarChar(255), data.fileName)
    .input('fileKey', sql.NVarChar(500), data.fileKey)
    .input('fileType', sql.NVarChar(100), data.fileType)
    .input('fileSize', sql.BigInt, data.fileSize).query<{ id: number }>(`
      INSERT INTO dbo.TaskAttachments (taskId, uploadedBy, fileName, fileKey, fileType, fileSize)
      OUTPUT INSERTED.id
      VALUES (@taskId, @uploadedBy, @fileName, @fileKey, @fileType, @fileSize)
    `);
  return result.recordset[0]!.id;
}

export async function deleteTaskAttachment(attachmentId: number): Promise<void> {
  const pool = getPool();
  await pool.request().input('id', sql.Int, attachmentId).query(`
    DELETE FROM dbo.TaskAttachments WHERE id = @id
  `);
}

export async function insertTaskActivity(
  taskId: number,
  userId: number,
  action: TaskActivityAction,
  metadata: Record<string, unknown> | null,
): Promise<void> {
  const pool = getPool();
  await pool
    .request()
    .input('taskId', sql.Int, taskId)
    .input('userId', sql.Int, userId)
    .input('action', sql.NVarChar(30), action)
    .input('metadata', sql.NVarChar(sql.MAX), metadata ? JSON.stringify(metadata) : null).query(`
      INSERT INTO dbo.TaskActivityLog (taskId, userId, action, metadata)
      VALUES (@taskId, @userId, @action, @metadata)
    `);
}

export async function listTaskActivity(taskId: number): Promise<TaskActivityRow[]> {
  const pool = getPool();
  const result = await pool.request().input('taskId', sql.Int, taskId).query<TaskActivityRow>(`
    SELECT l.id, l.taskId, l.userId, u.firstName AS authorFirstName,
           u.lastName AS authorLastName, l.action, l.metadata, l.createdAt
    FROM dbo.TaskActivityLog l
    INNER JOIN dbo.Users u ON l.userId = u.id
    WHERE l.taskId = @taskId
    ORDER BY l.createdAt DESC
  `);
  return result.recordset;
}

export async function listUsersByAreaIds(
  areaIds: number[],
): Promise<
  { id: number; firstName: string; lastName: string; areaId: number; areaName: string }[]
> {
  if (areaIds.length === 0) return [];
  const pool = getPool();
  const request = pool.request();
  const placeholders = areaIds.map((id, i) => {
    request.input(`area${i}`, sql.Int, id);
    return `@area${i}`;
  });
  const result = await request.query<{
    id: number;
    firstName: string;
    lastName: string;
    areaId: number;
    areaName: string;
  }>(`
    SELECT u.id, u.firstName, u.lastName, u.areaId, a.name AS areaName
    FROM dbo.Users u
    INNER JOIN dbo.Areas a ON u.areaId = a.id
    WHERE u.isActive = 1 AND u.areaId IN (${placeholders.join(', ')})
    ORDER BY a.name, u.lastName, u.firstName
  `);
  return result.recordset;
}

export interface BoardMetrics {
  byColumn: { columnId: number; columnName: string; count: number }[];
  byAssignee: { userId: number; name: string; count: number }[];
  overdueTasks: TaskRow[];
  completedLast30Days: number;
  avgCompletionHours: number | null;
}

export async function getBoardMetrics(boardId: number): Promise<BoardMetrics> {
  const pool = getPool();

  const byColumnResult = await pool.request().input('boardId', sql.Int, boardId).query<{
    columnId: number;
    columnName: string;
    count: number;
  }>(`
    SELECT bc.id AS columnId, bc.name AS columnName, COUNT(t.id) AS count
    FROM dbo.BoardColumns bc
    LEFT JOIN dbo.Tasks t ON t.columnId = bc.id AND t.archivedAt IS NULL
    WHERE bc.boardId = @boardId
    GROUP BY bc.id, bc.name, bc.[order]
    ORDER BY bc.[order]
  `);

  const byAssigneeResult = await pool.request().input('boardId', sql.Int, boardId).query<{
    userId: number;
    name: string;
    count: number;
  }>(`
    SELECT ta.userId, CONCAT(u.firstName, N' ', u.lastName) AS name, COUNT(*) AS count
    FROM dbo.TaskAssignees ta
    INNER JOIN dbo.Tasks t ON ta.taskId = t.id
    INNER JOIN dbo.Users u ON ta.userId = u.id
    WHERE t.boardId = @boardId AND t.archivedAt IS NULL AND t.status != N'DONE'
    GROUP BY ta.userId, u.firstName, u.lastName
    ORDER BY count DESC
  `);

  const overdueResult = await pool.request().input('boardId', sql.Int, boardId).query<TaskRow>(`
    SELECT ${TASK_SELECT}
    ${TASK_FROM}
    WHERE t.boardId = @boardId AND t.archivedAt IS NULL
      AND t.status != N'DONE' AND t.dueDate IS NOT NULL
      AND t.dueDate < CAST(SYSUTCDATETIME() AS DATE)
    ORDER BY t.dueDate
  `);

  const completedResult = await pool.request().input('boardId', sql.Int, boardId).query<{
    total: number;
  }>(`
    SELECT COUNT(*) AS total FROM dbo.Tasks
    WHERE boardId = @boardId AND status = N'DONE'
      AND completedAt >= DATEADD(day, -30, SYSUTCDATETIME())
  `);

  const avgResult = await pool.request().input('boardId', sql.Int, boardId).query<{
    avgHours: number | null;
  }>(`
    SELECT AVG(DATEDIFF(minute, createdAt, completedAt) / 60.0) AS avgHours
    FROM dbo.Tasks
    WHERE boardId = @boardId AND status = N'DONE' AND completedAt IS NOT NULL
  `);

  return {
    byColumn: byColumnResult.recordset,
    byAssignee: byAssigneeResult.recordset,
    overdueTasks: overdueResult.recordset,
    completedLast30Days: completedResult.recordset[0]?.total ?? 0,
    avgCompletionHours: avgResult.recordset[0]?.avgHours ?? null,
  };
}

export async function listTasksDueWithinHours(
  hours: number,
): Promise<(TaskRow & { assigneeIds: string | null })[]> {
  const pool = getPool();
  const result = await pool.request().input('hours', sql.Int, hours).query<
    TaskRow & { assigneeIds: string | null }
  >(`
    SELECT ${TASK_SELECT},
      STUFF((
        SELECT ',' + CAST(ta.userId AS NVARCHAR(20))
        FROM dbo.TaskAssignees ta WHERE ta.taskId = t.id
        FOR XML PATH(''), TYPE
      ).value('.', 'NVARCHAR(MAX)'), 1, 1, '') AS assigneeIds
    ${TASK_FROM}
    WHERE t.archivedAt IS NULL AND t.status != N'DONE'
      AND t.dueDate IS NOT NULL
      AND t.dueDate > SYSUTCDATETIME()
      AND t.dueDate <= DATEADD(hour, @hours, SYSUTCDATETIME())
  `);
  return result.recordset;
}

export async function transferTasksBetweenBoards(
  fromBoardId: number,
  toBoardId: number,
): Promise<void> {
  const fromCols = await listColumnsByBoardId(fromBoardId);
  const toCols = await listColumnsByBoardId(toBoardId);
  if (toCols.length === 0) {
    throw new Error('El tablero destino no tiene columnas');
  }

  const targetByStatus = new Map(toCols.map((col) => [col.defaultStatus, col.id]));
  const fallbackColumnId = toCols[0]!.id;
  const pool = getPool();

  for (const fromCol of fromCols) {
    const targetColumnId = targetByStatus.get(fromCol.defaultStatus) ?? fallbackColumnId;
    await pool
      .request()
      .input('fromColumnId', sql.Int, fromCol.id)
      .input('toColumnId', sql.Int, targetColumnId)
      .input('toBoardId', sql.Int, toBoardId).query(`
        UPDATE dbo.Tasks
        SET boardId = @toBoardId, columnId = @toColumnId, updatedAt = SYSUTCDATETIME()
        WHERE columnId = @fromColumnId
      `);
  }
}

export async function deleteAllTasksByBoardId(boardId: number): Promise<void> {
  const pool = getPool();
  await pool.request().input('boardId', sql.Int, boardId).query(`
    UPDATE dbo.Requests
    SET linkedTaskId = NULL, updatedAt = SYSUTCDATETIME()
    WHERE linkedTaskId IN (SELECT id FROM dbo.Tasks WHERE boardId = @boardId);

    DELETE FROM dbo.Tasks WHERE boardId = @boardId;
  `);
}
