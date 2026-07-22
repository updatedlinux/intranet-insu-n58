import { apiRequest } from './client';
import type {
  AreaOption,
  Collaborator,
  CollaboratorFilters,
  CollaboratorFormData,
  CollaboratorListResponse,
  CreateCollaboratorResponse,
  PositionOption,
  ResetPasswordResponse,
  RoleOption,
} from './collaborators.types';

function toQuery(filters: CollaboratorFilters): string {
  const params = new URLSearchParams();
  if (filters.search) params.set('search', filters.search);
  if (filters.email) params.set('email', filters.email);
  if (filters.roleId != null) params.set('roleId', String(filters.roleId));
  if (filters.isActive != null) params.set('isActive', String(filters.isActive));
  if (filters.areaId != null) params.set('areaId', String(filters.areaId));
  if (filters.positionId != null) params.set('positionId', String(filters.positionId));
  if (filters.page != null) params.set('page', String(filters.page));
  if (filters.pageSize != null) params.set('pageSize', String(filters.pageSize));
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export function fetchCollaborators(filters: CollaboratorFilters = {}) {
  return apiRequest<CollaboratorListResponse>(`/admin/colaboradores${toQuery(filters)}`);
}

export function fetchCollaborator(id: number) {
  return apiRequest<{ collaborator: Collaborator }>(`/admin/colaboradores/${id}`);
}

export function createCollaborator(data: CollaboratorFormData) {
  return apiRequest<CreateCollaboratorResponse>('/admin/colaboradores', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updateCollaborator(id: number, data: CollaboratorFormData) {
  return apiRequest<{ collaborator: Collaborator }>(`/admin/colaboradores/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export function setCollaboratorStatus(id: number, isActive: boolean) {
  return apiRequest<{ collaborator: Collaborator }>(`/admin/colaboradores/${id}/estado`, {
    method: 'PATCH',
    body: JSON.stringify({ isActive }),
  });
}

export function resetCollaboratorPassword(id: number) {
  return apiRequest<ResetPasswordResponse>(`/admin/colaboradores/${id}/reset-password`, {
    method: 'POST',
  });
}

export function deleteCollaborator(id: number) {
  return apiRequest<void>(`/admin/colaboradores/${id}`, { method: 'DELETE' });
}

export function fetchAdminRoles() {
  return apiRequest<{ roles: RoleOption[] }>('/admin/catalogos/roles');
}

export function fetchAdminAreas() {
  return apiRequest<{ areas: AreaOption[] }>('/admin/catalogos/areas');
}

export function fetchAdminPositions(areaId?: number) {
  const qs = areaId != null ? `?areaId=${areaId}` : '';
  return apiRequest<{ positions: PositionOption[] }>(`/admin/catalogos/positions${qs}`);
}
