import { config } from '../config';

const AVATARS_PREFIX = 'avatars/';

/** URL pública del objeto en MinIO (path-style). */
export function buildAvatarPublicUrl(objectKey: string): string {
  const base =
    config.storage.publicBaseUrl?.replace(/\/$/, '') ??
    `${config.storage.useSSL ? 'https' : 'http'}://${config.storage.endpoint}:${config.storage.port}/${config.storage.bucket}`;
  return `${base}/${objectKey.replace(/^\//, '')}`;
}

/** Extrae la clave del objeto desde la URL guardada o desde una ruta relativa. */
export function extractAvatarObjectKey(stored: string): string | null {
  const trimmed = stored.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith(AVATARS_PREFIX)) {
    return trimmed;
  }

  const bucket = config.storage.bucket;
  const marker = `/${bucket}/`;
  const idx = trimmed.indexOf(marker);
  if (idx >= 0) {
    return trimmed.slice(idx + marker.length);
  }

  try {
    const url = new URL(trimmed);
    const path = url.pathname.replace(/^\//, '');
    if (path.startsWith(`${bucket}/`)) {
      return path.slice(bucket.length + 1);
    }
    if (path.startsWith(AVATARS_PREFIX)) {
      return path;
    }
  } catch {
    return null;
  }

  return null;
}

/** Ruta de la API para mostrar el avatar (el bucket no es público). */
export function buildClientAvatarUrl(userId: number): string {
  return `/api/v1/users/${userId}/avatar`;
}

export function resolvePublicAvatarUrl(
  userId: number,
  stored: string | null | undefined,
): string | null {
  return stored?.trim() ? buildClientAvatarUrl(userId) : null;
}
