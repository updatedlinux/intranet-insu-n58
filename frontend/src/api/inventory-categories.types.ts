export interface AssetInventoryCategory {
  id: number;
  name: string;
  description: string | null;
  itemCount: number;
  createdAt: string;
}

export interface ConsumableInventoryCategory {
  id: number;
  name: string;
  description: string | null;
  itemCount: number;
  createdAt: string;
}

export interface AssetCategoryFormData {
  name: string;
  description: string | null;
}

export interface ConsumableCategoryFormData {
  name: string;
  description: string | null;
}
