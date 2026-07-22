import { apiRequest } from './client';
import type { Notification } from './notifications.types';

export function getNotificationsStreamUrl(): string {
  const base = import.meta.env.VITE_API_URL ?? '/api/v1';
  if (base.startsWith('http') && import.meta.env.DEV) {
    return '/api/v1/notifications/stream';
  }
  const normalized = base.replace(/\/$/, '');
  return `${normalized}/notifications/stream`;
}

export function fetchNotifications() {
  return apiRequest<{ items: Notification[] }>('/notifications');
}

export function fetchUnreadNotificationCount() {
  return apiRequest<{ count: number }>('/notifications/unread-count');
}

export function markNotificationRead(id: number) {
  return apiRequest<{ item: Notification }>(`/notifications/${id}/read`, { method: 'PATCH' });
}

export function markAllNotificationsRead() {
  return apiRequest<{ ok: boolean }>('/notifications/read-all', { method: 'PATCH' });
}
