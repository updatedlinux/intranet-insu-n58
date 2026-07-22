import { config } from '../config';
import { database } from '../config/database';
import { redis } from '../config/redis';
import { storage } from '../config/storage';

export type CheckStatus = 'up' | 'down';

export interface DependencyCheck {
  status: CheckStatus;
  message?: string;
}

export interface HealthResponse {
  status: 'ok' | 'degraded';
  environment: string;
  timestamp: string;
  uptime: number;
  checks: {
    database: DependencyCheck;
    storage: DependencyCheck;
    redis: DependencyCheck;
  };
}

export async function getHealthStatus(): Promise<HealthResponse> {
  const [databaseCheck, storageCheck, redisCheck] = await Promise.all([
    database.ping(),
    storage.ping(),
    redis.ping(),
  ]);

  const allUp =
    databaseCheck.status === 'up' && storageCheck.status === 'up' && redisCheck.status === 'up';

  return {
    status: allUp ? 'ok' : 'degraded',
    environment: config.env,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    checks: {
      database: databaseCheck,
      storage: storageCheck,
      redis: redisCheck,
    },
  };
}

export function getHealthHttpStatus(health: HealthResponse): number {
  return health.status === 'ok' ? 200 : 503;
}
