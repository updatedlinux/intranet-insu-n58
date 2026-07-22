import { apiRequest } from './client';
import type {
  Position,
  PositionFilters,
  PositionFormData,
  PositionListResponse,
} from './positions.types';

function toQuery(filters: PositionFilters): string {
  const params = new URLSearchParams();
  if (filters.name) params.set('name', filters.name);
  if (filters.areaId != null) params.set('areaId', String(filters.areaId));
  if (filters.isActive != null) params.set('isActive', String(filters.isActive));
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export function fetchPositions(filters: PositionFilters = {}) {
  return apiRequest<PositionListResponse>(`/positions${toQuery(filters)}`);
}

export function fetchPosition(id: number) {
  return apiRequest<{ position: Position }>(`/positions/${id}`);
}

export function createPosition(data: PositionFormData) {
  return apiRequest<{ position: Position }>('/positions', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updatePosition(id: number, data: PositionFormData) {
  return apiRequest<{ position: Position }>(`/positions/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export function togglePositionStatus(id: number, isActive: boolean) {
  return apiRequest<{ position: Position }>(`/positions/${id}/toggle`, {
    method: 'PATCH',
    body: JSON.stringify({ isActive }),
  });
}

export function deletePosition(id: number) {
  return apiRequest<void>(`/positions/${id}`, { method: 'DELETE' });
}
