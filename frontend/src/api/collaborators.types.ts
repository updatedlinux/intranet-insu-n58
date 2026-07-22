export interface Collaborator {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  role: { id: number; name: string };
  area: { id: number; name: string };
  position: { id: number; name: string };
  isActive: boolean;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: number | null;
  avatarUrl: string | null;
}

export interface CollaboratorListResponse {
  items: Collaborator[];
  total: number;
  page: number;
  pageSize: number;
}

export interface CollaboratorFilters {
  search?: string;
  email?: string;
  roleId?: number;
  isActive?: boolean;
  areaId?: number;
  positionId?: number;
  page?: number;
  pageSize?: number;
}

export interface CollaboratorFormData {
  firstName: string;
  lastName: string;
  email: string;
  roleId: number;
  areaId: number;
  positionId: number;
  isActive?: boolean;
}

export interface RoleOption {
  id: number;
  name: string;
  description: string | null;
}

export interface AreaOption {
  id: number;
  name: string;
}

export interface PositionOption {
  id: number;
  name: string;
  areaId: number;
}

export interface CreateCollaboratorResponse {
  collaborator: Collaborator;
  emailSent: boolean;
}

export interface ResetPasswordResponse {
  collaborator: Collaborator;
  emailSent: boolean;
}
