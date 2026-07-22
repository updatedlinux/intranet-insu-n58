import { getRedis, redis } from '../config/redis';
import { normalizeLoginEmail } from './login-rate-limit.service';

const FORGOT_ATTEMPTS_PREFIX = 'forgot:attempts:';
const MAX_ATTEMPTS = 3;
const WINDOW_SECONDS = 15 * 60;

function attemptsKey(normalizedEmail: string): string {
  return `${FORGOT_ATTEMPTS_PREFIX}${normalizedEmail}`;
}

export async function isForgotPasswordBlocked(normalizedEmail: string): Promise<boolean> {
  if (!normalizedEmail || !redis.isReady()) {
    return false;
  }

  const countRaw = await getRedis().get(attemptsKey(normalizedEmail));
  const count = countRaw ? Number.parseInt(countRaw, 10) : 0;
  return count >= MAX_ATTEMPTS;
}

export async function recordForgotPasswordAttempt(normalizedEmail: string): Promise<void> {
  if (!normalizedEmail || !redis.isReady()) {
    return;
  }

  const key = attemptsKey(normalizedEmail);
  const count = await getRedis().incr(key);
  if (count === 1) {
    await getRedis().expire(key, WINDOW_SECONDS);
  }
}

export { normalizeLoginEmail };
