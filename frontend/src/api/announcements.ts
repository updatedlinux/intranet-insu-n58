import { ApiError, apiRequest } from './client';
import type {
  Announcement,
  AnnouncementFilters,
  AnnouncementFormData,
} from './announcements.types';

const API_BASE = import.meta.env.VITE_API_URL ?? '/api/v1';

function toQuery(filters: AnnouncementFilters & { limit?: number }): string {
  const params = new URLSearchParams();
  if (filters.search?.trim()) params.set('search', filters.search.trim());
  if (filters.category) params.set('category', filters.category);
  if (filters.status) params.set('status', filters.status);
  if (filters.limit != null) params.set('limit', String(filters.limit));
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export function fetchAnnouncements(filters: AnnouncementFilters = {}) {
  return apiRequest<{ items: Announcement[] }>(`/announcements${toQuery(filters)}`);
}

export function fetchLatestAnnouncements(limit = 3) {
  return apiRequest<{ items: Announcement[] }>(`/announcements/latest?limit=${limit}`);
}

export function fetchManageAnnouncements(filters: AnnouncementFilters = {}) {
  return apiRequest<{ items: Announcement[] }>(`/announcements/manage${toQuery(filters)}`);
}

export function fetchAnnouncement(id: number) {
  return apiRequest<{ item: Announcement }>(`/announcements/${id}`);
}

export interface AnnouncementCapabilities {
  canManage: boolean;
  canPublishCompanyWide: boolean;
  publishableAreaIds: number[];
}

export function fetchAnnouncementCapabilities() {
  return apiRequest<AnnouncementCapabilities>('/announcements/capabilities');
}

export function createAnnouncement(data: AnnouncementFormData) {
  return apiRequest<{ item: Announcement }>('/announcements', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updateAnnouncement(id: number, data: AnnouncementFormData) {
  return apiRequest<{ item: Announcement }>(`/announcements/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export function publishAnnouncement(id: number) {
  return apiRequest<{ item: Announcement }>(`/announcements/${id}/publish`, { method: 'PATCH' });
}

export function archiveAnnouncement(id: number) {
  return apiRequest<{ item: Announcement }>(`/announcements/${id}/archive`, { method: 'PATCH' });
}

export async function uploadAnnouncementImage(file: File): Promise<{ imageKey: string }> {
  const form = new FormData();
  form.append('image', file);

  const response = await fetch(`${API_BASE}/announcements/upload-image`, {
    method: 'POST',
    body: form,
    credentials: 'include',
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiError(
      (data as { error?: { message?: string } }).error?.message ?? 'No se pudo subir la imagen',
      response.status,
    );
  }
  return data as { imageKey: string };
}
