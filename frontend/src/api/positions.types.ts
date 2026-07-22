export interface Position {
  id: number;
  name: string;
  areaId: number;
  areaName: string;
  isLeader: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  collaboratorCount: number;
  activeCollaboratorCount: number;
}

export interface PositionListResponse {
  items: Position[];
}

export interface PositionFilters {
  name?: string;
  areaId?: number;
  isActive?: boolean;
}

export interface PositionFormData {
  name: string;
  areaId: number;
  isLeader: boolean;
  isActive: boolean;
}
