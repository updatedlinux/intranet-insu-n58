/** Convierte JWT_EXPIRES_IN (ej. 8h, 24h, 15m) a segundos para TTL en Redis. */
export function parseJwtExpiresInSeconds(expiresIn: string): number {
  const trimmed = expiresIn.trim();
  const match = /^(\d+)([smhd])$/i.exec(trimmed);
  if (!match) {
    console.warn(`[jwt] JWT_EXPIRES_IN="${expiresIn}" no reconocido; usando 8h por defecto`);
    return 8 * 3600;
  }

  const value = Number.parseInt(match[1]!, 10);
  const unit = match[2]!.toLowerCase();
  const multipliers: Record<string, number> = {
    s: 1,
    m: 60,
    h: 3600,
    d: 86400,
  };

  return value * (multipliers[unit] ?? 3600);
}
