import { getRedis, redis } from '../config/redis';

const LOGIN_ATTEMPTS_PREFIX = 'login:attempts:';
const MAX_ATTEMPTS = 5;
const WINDOW_SECONDS = 15 * 60;

function attemptsKey(normalizedEmail: string): string {
  return `${LOGIN_ATTEMPTS_PREFIX}${normalizedEmail}`;
}

export function normalizeLoginEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function isLoginBlocked(normalizedEmail: string): Promise<boolean> {
  if (!normalizedEmail || !redis.isReady()) {
    return false;
  }

  const countRaw = await getRedis().get(attemptsKey(normalizedEmail));
  const count = countRaw ? Number.parseInt(countRaw, 10) : 0;
  return count >= MAX_ATTEMPTS;
}

export async function recordLoginFailure(normalizedEmail: string): Promise<void> {
  if (!normalizedEmail || !redis.isReady()) {
    return;
  }

  const key = attemptsKey(normalizedEmail);
  const count = await getRedis().incr(key);
  if (count === 1) {
    await getRedis().expire(key, WINDOW_SECONDS);
  }
}

export async function clearLoginAttempts(normalizedEmail: string): Promise<void> {
  if (!normalizedEmail || !redis.isReady()) {
    return;
  }

  await getRedis().del(attemptsKey(normalizedEmail));
}

export const LOGIN_RATE_LIMIT = {
  maxAttempts: MAX_ATTEMPTS,
  windowMinutes: 15,
};
