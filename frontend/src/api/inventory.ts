import { apiRequest, ApiError } from './client';
import type {
  Asset,
  AssetListFilters,
  AssetStatus,
  Consumable,
  ConsumableUnit,
  InventoryDashboard,
  MaintenanceType,
  StockMovement,
} from './inventory.types';

const API_BASE = (import.meta.env.VITE_API_URL ?? '/api/v1').replace(/\/$/, '');

function qs(params: Record<string, string | number | boolean | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}

export function fetchInventoryDashboard() {
  return apiRequest<InventoryDashboard>('/inventory/dashboard');
}

export function fetchInventoryReports() {
  return apiRequest<{
    assetsByUser: { userId: number; userName: string; assetCount: number }[];
    warrantyExpiring: {
      id: number;
      code: string;
      name: string;
      warrantyExpiry: string | null;
      assigneeName: string | null;
    }[];
    recentMovements: StockMovement[];
  }>('/inventory/reports');
}

export function fetchAssetCategories() {
  return apiRequest<{ items: { id: number; name: string }[] }>('/assets/categories');
}

export function fetchAssets(filters?: AssetListFilters) {
  return apiRequest<{ items: Asset[] }>(
    `/assets${qs((filters ?? {}) as Record<string, string | number | boolean | undefined>)}`,
  );
}

export async function uploadAssetPhoto(assetId: number, file: File): Promise<{ photoUrl: string }> {
  const formData = new FormData();
  formData.append('photo', file);

  const response = await fetch(`${API_BASE}/assets/${assetId}/photo`, {
    method: 'POST',
    body: formData,
    credentials: 'include',
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      (data as { message?: string; error?: { message?: string } }).message ??
      (data as { error?: { message?: string } }).error?.message ??
      'No se pudo subir la foto';
    throw new ApiError(message, response.status);
  }

  return data as { photoUrl: string };
}

export async function deleteAssetPhoto(assetId: number): Promise<void> {
  const response = await fetch(`${API_BASE}/assets/${assetId}/photo`, {
    method: 'DELETE',
    credentials: 'include',
  });
  if (!response.ok && response.status !== 204) {
    const data = await response.json().catch(() => ({}));
    throw new ApiError(
      (data as { message?: string }).message ?? 'No se pudo eliminar la foto',
      response.status,
    );
  }
}

export async function uploadConsumablePhoto(
  consumableId: number,
  file: File,
): Promise<{ photoUrl: string }> {
  const formData = new FormData();
  formData.append('photo', file);

  const response = await fetch(`${API_BASE}/consumables/${consumableId}/photo`, {
    method: 'POST',
    body: formData,
    credentials: 'include',
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      (data as { message?: string; error?: { message?: string } }).message ??
      (data as { error?: { message?: string } }).error?.message ??
      'No se pudo subir la foto';
    throw new ApiError(message, response.status);
  }

  return data as { photoUrl: string };
}

export async function deleteConsumablePhoto(consumableId: number): Promise<void> {
  const response = await fetch(`${API_BASE}/consumables/${consumableId}/photo`, {
    method: 'DELETE',
    credentials: 'include',
  });
  if (!response.ok && response.status !== 204) {
    const data = await response.json().catch(() => ({}));
    throw new ApiError(
      (data as { message?: string }).message ?? 'No se pudo eliminar la foto',
      response.status,
    );
  }
}

export function fetchAsset(id: number) {
  return apiRequest<{
    item: Asset;
    assignments: {
      id: number;
      userName: string;
      assignedByName: string;
      assignedAt: string;
      returnedAt: string | null;
      notes: string | null;
    }[];
    maintenance: {
      id: number;
      type: MaintenanceType;
      description: string;
      cost: number | null;
      performedAt: string;
      performerName: string;
      relatedTicketCode: string | null;
    }[];
  }>(`/assets/${id}`);
}

export function fetchUserAssets(userId: number) {
  return apiRequest<{ items: Asset[] }>(`/assets/user/${userId}`);
}

export function createAsset(data: Record<string, unknown>) {
  return apiRequest<{ item: Asset }>('/assets', { method: 'POST', body: JSON.stringify(data) });
}

export function updateAsset(id: number, data: Record<string, unknown>) {
  return apiRequest(`/assets/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
}

export function assignAsset(id: number, userId: number, notes?: string) {
  return apiRequest(`/assets/${id}/assign`, {
    method: 'PATCH',
    body: JSON.stringify({ userId, notes: notes ?? null }),
  });
}

export function unassignAsset(id: number) {
  return apiRequest(`/assets/${id}/unassign`, { method: 'PATCH', body: '{}' });
}

export function updateAssetStatus(id: number, status: AssetStatus) {
  return apiRequest(`/assets/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
}

export function addAssetMaintenance(id: number, data: Record<string, unknown>) {
  return apiRequest(`/assets/${id}/maintenance`, { method: 'POST', body: JSON.stringify(data) });
}

export function fetchConsumableCategories() {
  return apiRequest<{ items: { id: number; name: string }[] }>('/consumables/categories');
}

export function fetchConsumables(filters?: {
  categoryId?: number;
  lowStockOnly?: boolean;
  search?: string;
}) {
  return apiRequest<{ items: Consumable[] }>(`/consumables${qs(filters ?? {})}`);
}

export function fetchConsumable(id: number) {
  return apiRequest<{ item: Consumable; movements: StockMovement[] }>(`/consumables/${id}`);
}

export function createConsumable(data: Record<string, unknown>) {
  return apiRequest<{ item: Consumable }>('/consumables', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updateConsumable(id: number, data: Record<string, unknown>) {
  return apiRequest(`/consumables/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
}

export function stockIn(
  consumableId: number,
  quantity: number,
  reason?: string,
  relatedTicketId?: number,
) {
  return apiRequest(`/consumables/${consumableId}/stock/in`, {
    method: 'POST',
    body: JSON.stringify({
      quantity,
      reason: reason ?? null,
      relatedTicketId: relatedTicketId ?? null,
    }),
  });
}

export function stockOut(
  consumableId: number,
  quantity: number,
  reason?: string,
  relatedTicketId?: number,
) {
  return apiRequest(`/consumables/${consumableId}/stock/out`, {
    method: 'POST',
    body: JSON.stringify({
      quantity,
      reason: reason ?? null,
      relatedTicketId: relatedTicketId ?? null,
    }),
  });
}

export function stockAdjust(consumableId: number, newStock: number, reason: string) {
  return apiRequest(`/consumables/${consumableId}/stock/adjust`, {
    method: 'POST',
    body: JSON.stringify({ newStock, reason }),
  });
}

export function fetchTicketConsumableUsage(ticketId: number) {
  return apiRequest<{ items: StockMovement[] }>(`/consumables/ticket-usage/${ticketId}`);
}

export const ASSET_STATUS_LABELS: Record<AssetStatus, string> = {
  ACTIVE: 'Activo',
  IN_MAINTENANCE: 'Mantenimiento',
  RETIRED: 'Retirado',
  LOST: 'Perdido',
  STOLEN: 'Robado',
};

export const CONSUMABLE_UNIT_LABELS: Record<ConsumableUnit, string> = {
  UNIT: 'Unidad',
  BOX: 'Caja',
  PACK: 'Paquete',
  ROLL: 'Rollo',
};
