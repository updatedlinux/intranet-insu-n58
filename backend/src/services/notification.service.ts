import type { NotificationResourceType, NotificationType } from '../constants/notification-type';
import type { AppError } from '../middlewares/error.middleware';
import {
  countUnreadNotifications,
  findNotificationById,
  insertNotification,
  listNotificationsByUser,
  markAllNotificationsAsRead,
  markNotificationAsRead,
  type NotificationRow,
} from '../repositories/notification.repository';
import type { PublicNotification } from '../types/notification';
import { broadcastToUser } from './sse.service';

function notFound(message = 'Notificación no encontrada'): AppError {
  const error = new Error(message) as AppError;
  error.statusCode = 404;
  return error;
}

function toPublic(row: NotificationRow): PublicNotification {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    message: row.message,
    resourceType: row.resourceType,
    resourceId: row.resourceId,
    isRead: row.isRead,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function createNotification(
  userId: number,
  type: NotificationType,
  title: string,
  message: string,
  resourceType?: NotificationResourceType | null,
  resourceId?: number | null,
): Promise<PublicNotification> {
  const id = await insertNotification({
    userId,
    type,
    title,
    message: message.slice(0, 500),
    resourceType: resourceType ?? null,
    resourceId: resourceId ?? null,
  });

  const row = await findNotificationById(id);
  if (!row) throw notFound();

  const notification = toPublic(row);
  broadcastToUser(userId, notification);
  return notification;
}

export async function createNotificationsForUsers(
  userIds: number[],
  type: NotificationType,
  title: string,
  message: string,
  resourceType?: NotificationResourceType | null,
  resourceId?: number | null,
): Promise<void> {
  const uniqueIds = [...new Set(userIds)].filter((id) => id > 0);
  for (const userId of uniqueIds) {
    try {
      await createNotification(userId, type, title, message, resourceType, resourceId);
    } catch (error) {
      console.error(
        `[notifications] Error al crear notificación para userId=${userId}:`,
        error instanceof Error ? error.message : error,
      );
    }
  }
}

export async function markAsRead(
  notificationId: number,
  userId: number,
): Promise<PublicNotification> {
  const existing = await findNotificationById(notificationId);
  if (!existing || existing.userId !== userId) throw notFound();

  if (!existing.isRead) {
    await markNotificationAsRead(notificationId, userId);
  }

  const row = await findNotificationById(notificationId);
  if (!row) throw notFound();
  return toPublic(row);
}

export async function markAllAsRead(userId: number): Promise<{ updated: number }> {
  const updated = await markAllNotificationsAsRead(userId);
  return { updated };
}

export async function getUserNotifications(userId: number): Promise<PublicNotification[]> {
  const rows = await listNotificationsByUser(userId, 30);
  return rows.map(toPublic);
}

export async function getUnreadCount(userId: number): Promise<number> {
  return countUnreadNotifications(userId);
}
