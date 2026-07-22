import { apiRequest } from './client';
import type {
  AssetCategoryFormData,
  AssetInventoryCategory,
  ConsumableCategoryFormData,
  ConsumableInventoryCategory,
} from './inventory-categories.types';

function qs(name?: string): string {
  if (!name?.trim()) return '';
  return `?name=${encodeURIComponent(name.trim())}`;
}

export function fetchAssetInventoryCategories(name?: string) {
  return apiRequest<{ items: AssetInventoryCategory[] }>(`/inventory-categories/assets${qs(name)}`);
}

export function fetchAssetInventoryCategory(id: number) {
  return apiRequest<{ item: AssetInventoryCategory }>(`/inventory-categories/assets/${id}`);
}

export function createAssetInventoryCategory(data: AssetCategoryFormData) {
  return apiRequest<{ item: AssetInventoryCategory }>('/inventory-categories/assets', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updateAssetInventoryCategory(id: number, data: AssetCategoryFormData) {
  return apiRequest<{ item: AssetInventoryCategory }>(`/inventory-categories/assets/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export function deleteAssetInventoryCategory(id: number) {
  return apiRequest<void>(`/inventory-categories/assets/${id}`, { method: 'DELETE' });
}

export function fetchConsumableInventoryCategories(name?: string) {
  return apiRequest<{ items: ConsumableInventoryCategory[] }>(
    `/inventory-categories/consumables${qs(name)}`,
  );
}

export function fetchConsumableInventoryCategory(id: number) {
  return apiRequest<{ item: ConsumableInventoryCategory }>(
    `/inventory-categories/consumables/${id}`,
  );
}

export function createConsumableInventoryCategory(data: ConsumableCategoryFormData) {
  return apiRequest<{ item: ConsumableInventoryCategory }>('/inventory-categories/consumables', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updateConsumableInventoryCategory(id: number, data: ConsumableCategoryFormData) {
  return apiRequest<{ item: ConsumableInventoryCategory }>(
    `/inventory-categories/consumables/${id}`,
    { method: 'PUT', body: JSON.stringify(data) },
  );
}

export function deleteConsumableInventoryCategory(id: number) {
  return apiRequest<void>(`/inventory-categories/consumables/${id}`, { method: 'DELETE' });
}
