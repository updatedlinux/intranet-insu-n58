const API_BASE = (import.meta.env.VITE_API_URL ?? '/api/v1').replace(/\/$/, '');

export type InventoryPhotoKind = 'asset' | 'consumable';

/** URL de la foto servida por la API (MinIO no es público). */
export function resolveInventoryPhotoDisplayUrl(
  kind: InventoryPhotoKind,
  itemId: number,
  photoUrl: string | null | undefined,
): string | null {
  if (!photoUrl?.trim()) return null;
  const segment = kind === 'asset' ? 'assets' : 'consumables';
  return `${API_BASE}/${segment}/${itemId}/photo`;
}
