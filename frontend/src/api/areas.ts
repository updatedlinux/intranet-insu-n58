import { apiRequest } from './client';
import type {
  Area,
  AreaDeletePayload,
  AreaDeletePreview,
  AreaFilters,
  AreaFormData,
  AreaListResponse,
} from './areas.types';

function toQuery(filters: AreaFilters): string {
  const params = new URLSearchParams();
  if (filters.name) params.set('name', filters.name);
  if (filters.isActive != null) params.set('isActive', String(filters.isActive));
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export function fetchAreas(filters: AreaFilters = {}) {
  return apiRequest<AreaListResponse>(`/areas${toQuery(filters)}`);
}

export function fetchArea(id: number) {
  return apiRequest<{ area: Area }>(`/areas/${id}`);
}

export function createArea(data: AreaFormData) {
  return apiRequest<{ area: Area }>('/areas', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updateArea(id: number, data: AreaFormData) {
  return apiRequest<{ area: Area }>(`/areas/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export function toggleAreaStatus(id: number, isActive: boolean) {
  return apiRequest<{ area: Area }>(`/areas/${id}/toggle`, {
    method: 'PATCH',
    body: JSON.stringify({ isActive }),
  });
}

export function fetchAreaDeletePreview(id: number) {
  return apiRequest<{ preview: AreaDeletePreview }>(`/areas/${id}/delete-preview`);
}

export function deleteArea(id: number, payload?: AreaDeletePayload) {
  return apiRequest<void>(`/areas/${id}`, {
    method: 'DELETE',
    body: JSON.stringify(payload ?? {}),
  });
}
