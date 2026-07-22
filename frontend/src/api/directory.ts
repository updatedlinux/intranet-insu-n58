import { apiRequest } from './client';
import type { DirectoryFilters, DirectoryListResponse } from './directory.types';

function toQuery(filters: DirectoryFilters): string {
  const params = new URLSearchParams();
  if (filters.name?.trim()) params.set('name', filters.name.trim());
  if (filters.areaId != null) params.set('areaId', String(filters.areaId));
  if (filters.positionId != null) params.set('positionId', String(filters.positionId));
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export function fetchDirectory(filters: DirectoryFilters = {}) {
  return apiRequest<DirectoryListResponse>(`/directory${toQuery(filters)}`);
}
