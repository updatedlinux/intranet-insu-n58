export interface DirectoryEntry {
  id: number;
  fullName: string;
  firstName: string;
  lastName: string;
  email: string;
  areaId: number;
  areaName: string;
  positionId: number;
  positionName: string;
  avatarUrl: string | null;
}

export interface DirectoryFilterOption {
  id: number;
  name: string;
}

export interface DirectoryPositionOption extends DirectoryFilterOption {
  areaId: number;
}

export interface DirectoryFilters {
  name?: string;
  areaId?: number;
  positionId?: number;
}

export interface DirectoryListResponse {
  items: DirectoryEntry[];
  filterOptions: {
    areas: DirectoryFilterOption[];
    positions: DirectoryPositionOption[];
  };
}
