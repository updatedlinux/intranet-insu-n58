/** Ruta de la API para mostrar la foto del activo (MinIO no es público). */
export function buildClientAssetPhotoUrl(assetId: number): string {
  return `/api/v1/assets/${assetId}/photo`;
}

export function resolvePublicAssetPhotoUrl(
  assetId: number,
  imageKey: string | null | undefined,
): string | null {
  return imageKey?.trim() ? buildClientAssetPhotoUrl(assetId) : null;
}
