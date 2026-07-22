export type AssetStatus = 'ACTIVE' | 'IN_MAINTENANCE' | 'RETIRED' | 'LOST' | 'STOLEN';
export type AssetCondition = 'NEW' | 'GOOD' | 'FAIR' | 'POOR';
export type MaintenanceType = 'PREVENTIVE' | 'CORRECTIVE' | 'UPGRADE';
export type ConsumableUnit = 'UNIT' | 'BOX' | 'PACK' | 'ROLL';
export type StockMovementType = 'IN' | 'OUT' | 'ADJUSTMENT';

export interface Asset {
  id: number;
  code: string;
  serial: string | null;
  sku: string | null;
  name: string;
  brand: string | null;
  model: string | null;
  description: string | null;
  categoryId: number;
  categoryName: string;
  status: AssetStatus;
  condition: AssetCondition;
  purchaseDate: string | null;
  warrantyExpiry: string | null;
  purchasePrice: number | null;
  location: string | null;
  assignedTo: number | null;
  assigneeName: string | null;
  assignedAt: string | null;
  notes: string | null;
  photoUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AssetListFilters {
  categoryId?: number;
  status?: AssetStatus;
  assignedTo?: number;
  unassignedOnly?: boolean;
  search?: string;
  purchaseDateFrom?: string;
  purchaseDateTo?: string;
  createdFrom?: string;
  createdTo?: string;
  assignedFrom?: string;
  assignedUntil?: string;
}

export interface Consumable {
  id: number;
  sku: string;
  name: string;
  brand: string | null;
  model: string | null;
  description: string | null;
  categoryId: number;
  categoryName: string;
  unit: ConsumableUnit;
  currentStock: number;
  minimumStock: number;
  isLowStock: boolean;
  location: string | null;
  photoUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InventoryDashboard {
  totalAssets: number;
  assignedAssets: number;
  availableAssets: number;
  maintenanceAssets: number;
  lowStockConsumables: number;
  hasLowStockAlert: boolean;
}

export interface StockMovement {
  id: number;
  consumableId: number;
  consumableName?: string;
  consumableSku?: string;
  type: StockMovementType;
  quantity: number;
  previousStock: number;
  newStock: number;
  reason: string | null;
  relatedTicketId: number | null;
  relatedTicketCode: string | null;
  performerName: string;
  createdAt: string;
}
