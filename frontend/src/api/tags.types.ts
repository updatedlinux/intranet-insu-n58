export interface DocTag {
  id: number;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  documentCount: number;
}

export interface TagFilters {
  name?: string;
  isActive?: boolean;
}

export interface TagListResponse {
  items: DocTag[];
}

export interface TagFormData {
  name: string;
  description?: string | null;
  isActive: boolean;
}
