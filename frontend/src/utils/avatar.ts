const API_BASE = (import.meta.env.VITE_API_URL ?? '/api/v1').replace(/\/$/, '');

/** URL del avatar servida por la API (MinIO no es público). */
export function resolveAvatarDisplayUrl(
  userId: number,
  avatarUrl: string | null | undefined,
): string | null {
  if (!avatarUrl?.trim()) return null;
  return `${API_BASE}/users/${userId}/avatar`;
}
