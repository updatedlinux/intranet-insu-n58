export interface AreaAccessGrant {
  id: number;
  sourceAreaId: number;
  targetAreaId: number;
  sourceAreaName: string;
  targetAreaName: string;
  canRead: boolean;
  canUpload: boolean;
  canApprove: boolean;
  canAnnounce: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AreaAccessListResponse {
  items: AreaAccessGrant[];
}

export interface AreaAccessFilters {
  sourceAreaId?: number;
  targetAreaId?: number;
  isActive?: boolean;
}

export interface AreaAccessFormData {
  sourceAreaId: number;
  targetAreaId: number;
  canRead: boolean;
  canUpload: boolean;
  canApprove: boolean;
  canAnnounce: boolean;
  isActive: boolean;
}
