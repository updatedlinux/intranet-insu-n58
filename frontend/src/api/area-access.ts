import { apiRequest } from './client';
import type {
  AreaAccessFilters,
  AreaAccessFormData,
  AreaAccessGrant,
  AreaAccessListResponse,
} from './area-access.types';

function toQuery(filters: AreaAccessFilters): string {
  const params = new URLSearchParams();
  if (filters.sourceAreaId != null) params.set('sourceAreaId', String(filters.sourceAreaId));
  if (filters.targetAreaId != null) params.set('targetAreaId', String(filters.targetAreaId));
  if (filters.isActive != null) params.set('isActive', String(filters.isActive));
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export function fetchAreaAccessList(filters: AreaAccessFilters = {}) {
  return apiRequest<AreaAccessListResponse>(`/area-access${toQuery(filters)}`);
}

export function fetchAreaAccess(id: number) {
  return apiRequest<{ item: AreaAccessGrant }>(`/area-access/${id}`);
}

export function createAreaAccess(data: AreaAccessFormData) {
  return apiRequest<{ item: AreaAccessGrant }>('/area-access', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updateAreaAccess(id: number, data: AreaAccessFormData) {
  return apiRequest<{ item: AreaAccessGrant }>(`/area-access/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export function deleteAreaAccess(id: number) {
  return apiRequest<void>(`/area-access/${id}`, { method: 'DELETE' });
}
