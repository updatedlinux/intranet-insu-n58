import type { NotificationResourceType, NotificationType } from '../constants/notification-type';

export interface PublicNotification {
  id: number;
  type: NotificationType;
  title: string;
  message: string;
  resourceType: NotificationResourceType | null;
  resourceId: number | null;
  isRead: boolean;
  createdAt: string;
}
