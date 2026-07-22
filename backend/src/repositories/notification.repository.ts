import sql from 'mssql';
import type { NotificationResourceType } from '../constants/notification-type';
import type { NotificationType } from '../constants/notification-type';
import { getPool } from '../config/database';

export interface NotificationRow {
  id: number;
  userId: number;
  type: NotificationType;
  title: string;
  message: string;
  resourceType: NotificationResourceType | null;
  resourceId: number | null;
  isRead: boolean;
  createdAt: Date;
}

export interface NotificationInsertInput {
  userId: number;
  type: NotificationType;
  title: string;
  message: string;
  resourceType?: NotificationResourceType | null;
  resourceId?: number | null;
}

const SELECT = `
  n.id,
  n.userId,
  n.type,
  n.title,
  n.message,
  n.resourceType,
  n.resourceId,
  n.isRead,
  n.createdAt
`;

export async function insertNotification(input: NotificationInsertInput): Promise<number> {
  const pool = getPool();
  const result = await pool
    .request()
    .input('userId', sql.Int, input.userId)
    .input('type', sql.NVarChar(40), input.type)
    .input('title', sql.NVarChar(255), input.title)
    .input('message', sql.NVarChar(500), input.message)
    .input('resourceType', sql.NVarChar(40), input.resourceType ?? null)
    .input('resourceId', sql.Int, input.resourceId ?? null).query<{ id: number }>(`
      INSERT INTO dbo.Notifications (userId, type, title, message, resourceType, resourceId)
      OUTPUT INSERTED.id
      VALUES (@userId, @type, @title, @message, @resourceType, @resourceId)
    `);
  return result.recordset[0]!.id;
}

export async function findNotificationById(id: number): Promise<NotificationRow | null> {
  const pool = getPool();
  const result = await pool.request().input('id', sql.Int, id).query<NotificationRow>(`
    SELECT ${SELECT}
    FROM dbo.Notifications n
    WHERE n.id = @id
  `);
  const row = result.recordset[0];
  if (!row) return null;
  return { ...row, isRead: Boolean(row.isRead) };
}

export async function listNotificationsByUser(
  userId: number,
  limit = 30,
): Promise<NotificationRow[]> {
  const pool = getPool();
  const top = Math.min(Math.max(limit, 1), 100);
  const result = await pool.request().input('userId', sql.Int, userId).query<NotificationRow>(`
    SELECT TOP (${top}) ${SELECT}
    FROM dbo.Notifications n
    WHERE n.userId = @userId
    ORDER BY n.createdAt DESC
  `);
  return result.recordset.map((row) => ({ ...row, isRead: Boolean(row.isRead) }));
}

export async function countUnreadNotifications(userId: number): Promise<number> {
  const pool = getPool();
  const result = await pool.request().input('userId', sql.Int, userId).query<{ total: number }>(`
    SELECT COUNT(*) AS total
    FROM dbo.Notifications n
    WHERE n.userId = @userId AND n.isRead = 0
  `);
  return result.recordset[0]?.total ?? 0;
}

export async function markNotificationAsRead(id: number, userId: number): Promise<boolean> {
  const pool = getPool();
  const result = await pool.request().input('id', sql.Int, id).input('userId', sql.Int, userId)
    .query(`
      UPDATE dbo.Notifications
      SET isRead = 1
      WHERE id = @id AND userId = @userId AND isRead = 0
    `);
  return (result.rowsAffected[0] ?? 0) > 0;
}

export async function markAllNotificationsAsRead(userId: number): Promise<number> {
  const pool = getPool();
  const result = await pool.request().input('userId', sql.Int, userId).query(`
    UPDATE dbo.Notifications
    SET isRead = 1
    WHERE userId = @userId AND isRead = 0
  `);
  return result.rowsAffected[0] ?? 0;
}
