export interface AreaLeader {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  areaName: string;
  positionName: string;
}

export interface Area {
  id: number;
  name: string;
  description: string | null;
  parentAreaId: number | null;
  parentAreaName: string | null;
  isActive: boolean;
  isItSupportArea: boolean;
  createdAt: string;
  updatedAt: string;
  collaboratorCount: number;
  activeCollaboratorCount: number;
  leaders: AreaLeader[];
}

export interface AreaListResponse {
  items: Area[];
}

export interface AreaFilters {
  name?: string;
  isActive?: boolean;
}

export interface AreaFormData {
  name: string;
  description?: string | null;
  parentAreaId?: number | null;
  isActive: boolean;
  isItSupportArea?: boolean;
  leaderIds?: number[];
}

export interface AreaOption {
  id: number;
  name: string;
}

export interface AreaDeletePreview {
  childAreas: number;
  collaborators: number;
  documents: number;
  folders: number;
  tasks: number;
  learningAccess: number;
  corporateEvents: number;
  requiresTaskDecision: boolean;
}

export type AreaDeleteTaskAction = 'transfer' | 'delete';

export interface AreaDeletePayload {
  taskAction?: AreaDeleteTaskAction;
  transferToAreaId?: number;
}
