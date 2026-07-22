/** Ruta de la API para mostrar la foto del consumible (MinIO no es público). */
export function buildClientConsumablePhotoUrl(consumableId: number): string {
  return `/api/v1/consumables/${consumableId}/photo`;
}

export function resolvePublicConsumablePhotoUrl(
  consumableId: number,
  imageKey: string | null | undefined,
): string | null {
  return imageKey?.trim() ? buildClientConsumablePhotoUrl(consumableId) : null;
}
