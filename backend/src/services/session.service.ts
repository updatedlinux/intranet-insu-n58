import { getRedis, redis } from '../config/redis';
import { config } from '../config';
import { parseJwtExpiresInSeconds } from '../utils/jwt-duration';

const SESSION_KEY_PREFIX = 'session:';

export function buildSessionKey(userId: number): string {
  return `${SESSION_KEY_PREFIX}${userId}`;
}

function sessionTtlSeconds(): number {
  return parseJwtExpiresInSeconds(config.jwt.expiresIn);
}

export async function createSession(userId: number, jti: string): Promise<void> {
  if (!config.redis.enabled || !redis.isReady()) {
    return;
  }

  const key = buildSessionKey(userId);
  const ttl = sessionTtlSeconds();
  await getRedis().set(key, jti, 'EX', ttl);
}

export async function isSessionActive(userId: number, jti: string): Promise<boolean> {
  // Sin Redis (deshabilitado o no conectado) la sesión se valida solo por JWT,
  // coherente con createSession que tampoco persiste en ese caso.
  if (!config.redis.enabled || !redis.isReady()) {
    if (config.redis.enabled && !redis.isReady()) {
      console.warn('[session] Redis no disponible; validando sesión solo por JWT');
    }
    return true;
  }

  const stored = await getRedis().get(buildSessionKey(userId));
  return stored === jti;
}

export async function revokeSession(userId: number): Promise<void> {
  if (!config.redis.enabled || !redis.isReady()) {
    return;
  }

  await getRedis().del(buildSessionKey(userId));
}
