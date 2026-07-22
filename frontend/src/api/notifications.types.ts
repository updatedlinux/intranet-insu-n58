export type NotificationType =
  | 'ANNOUNCEMENT'
  | 'DOCUMENT_PENDING'
  | 'DOCUMENT_APPROVED'
  | 'DOCUMENT_REJECTED'
  | 'TICKET_CREATED'
  | 'TICKET_ASSIGNED'
  | 'TICKET_COMMENT'
  | 'TICKET_RESOLVED'
  | 'TASK_ASSIGNED'
  | 'TASK_MOVED'
  | 'TASK_COMMENT'
  | 'TASK_DUE_SOON'
  | 'MEETING_CREATED'
  | 'MEETING_RESCHEDULED'
  | 'MEETING_CANCELLED'
  | 'MEETING_REMINDER'
  | 'REQUEST_CREATED'
  | 'REQUEST_RECEIVED'
  | 'REQUEST_IN_PROGRESS'
  | 'REQUEST_RESOLVED'
  | 'REQUEST_REJECTED'
  | 'REQUEST_CLOSED'
  | 'INVENTORY_LOW_STOCK'
  | 'CHAT_MESSAGE'
  | 'SYSTEM';

export type NotificationResourceType =
  | 'announcement'
  | 'document'
  | 'folder'
  | 'ticket'
  | 'task'
  | 'board'
  | 'meeting'
  | 'request'
  | 'inventory'
  | 'chat';

export interface Notification {
  id: number;
  type: NotificationType;
  title: string;
  message: string;
  resourceType: NotificationResourceType | null;
  resourceId: number | null;
  isRead: boolean;
  createdAt: string;
}
