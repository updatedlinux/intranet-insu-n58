export interface ChatAreaAccessGrant {
  id: number;
  userId: number;
  areaId: number;
  userFullName: string;
  userEmail: string;
  userAreaName: string;
  areaName: string;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ChatAreaAccessFilters {
  userId?: number;
  areaId?: number;
  isActive?: boolean;
}

export interface ChatAreaAccessFormData {
  userId: number;
  areaId: number;
  notes: string | null;
  isActive: boolean;
}

export interface ChatAreaAccessListResponse {
  items: ChatAreaAccessGrant[];
}
