import { apiRequest } from './client';
import type { DocTag, TagFilters, TagFormData, TagListResponse } from './tags.types';

function toQuery(filters: TagFilters): string {
  const params = new URLSearchParams();
  if (filters.name) params.set('name', filters.name);
  if (filters.isActive != null) params.set('isActive', String(filters.isActive));
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export function fetchTags(filters: TagFilters = {}) {
  return apiRequest<TagListResponse>(`/tags${toQuery(filters)}`);
}

export function fetchActiveTags() {
  return fetchTags({ isActive: true });
}

export function fetchTag(id: number) {
  return apiRequest<{ tag: DocTag }>(`/tags/${id}`);
}

export function createTag(data: TagFormData) {
  return apiRequest<{ tag: DocTag }>('/tags', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updateTag(id: number, data: TagFormData) {
  return apiRequest<{ tag: DocTag }>(`/tags/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export function toggleTagStatus(id: number, isActive: boolean) {
  return apiRequest<{ tag: DocTag }>(`/tags/${id}/toggle`, {
    method: 'PATCH',
    body: JSON.stringify({ isActive }),
  });
}

export function deleteTag(id: number) {
  return apiRequest<void>(`/tags/${id}`, { method: 'DELETE' });
}
