import Redis, { type Redis as RedisConnection, type RedisOptions } from 'ioredis';
import { config } from './index';

class RedisClient {
  private client: RedisConnection | null = null;
  private connectPromise: Promise<RedisConnection> | null = null;
  private lastErrorLoggedAt = 0;

  private buildOptions(): RedisOptions {
    const options: RedisOptions = {
      host: config.redis.host,
      port: config.redis.port,
      maxRetriesPerRequest: 3,
      retryStrategy: (times: number) => {
        if (times > 10) return null;
        return Math.min(times * 200, 3000);
      },
      lazyConnect: true,
    };

    if (config.redis.password) {
      options.password = config.redis.password;
    }

    return options;
  }

  private logConnectionError(message: string, error?: unknown): void {
    const now = Date.now();
    if (now - this.lastErrorLoggedAt < 10_000) return;
    this.lastErrorLoggedAt = now;
    console.error(`[redis] ${message}`, error instanceof Error ? error.message : (error ?? ''));
  }

  async connect(): Promise<void> {
    if (!config.redis.enabled) {
      console.warn(
        '[redis] Omitido (REDIS_ENABLED=false). Sesiones validadas solo por JWT; rate limit y reset de contraseña en Redis desactivados.',
      );
      return;
    }

    if (this.client?.status === 'ready') {
      return;
    }

    if (this.connectPromise) {
      await this.connectPromise;
      return;
    }

    console.log(
      `[redis] Conectando a ${config.redis.host}:${config.redis.port} (${config.env})...`,
    );

    const instance = new Redis(this.buildOptions());

    instance.on('error', (err) => {
      this.logConnectionError('Error de conexión', err);
    });

    instance.on('connect', () => {
      console.log('[redis] Conexión establecida');
    });

    this.connectPromise = instance.connect().then(() => {
      this.client = instance;
      return instance;
    });

    try {
      await this.connectPromise;
      console.log('[redis] Cliente listo');
    } catch (error) {
      this.logConnectionError('No se pudo conectar al iniciar', error);
      this.client = instance;
    } finally {
      this.connectPromise = null;
    }
  }

  getClient(): RedisConnection {
    if (!this.client) {
      throw new Error(
        '[redis] Cliente no inicializado. Ejecute redis.connect() al arrancar la aplicación.',
      );
    }
    return this.client;
  }

  isReady(): boolean {
    return this.client?.status === 'ready';
  }

  async ping(): Promise<{ status: 'up' | 'down'; message?: string }> {
    try {
      if (!this.isReady()) {
        return { status: 'down', message: 'Cliente no conectado' };
      }
      const pong = await this.client!.ping();
      return pong === 'PONG' ? { status: 'up' } : { status: 'down', message: 'Respuesta inválida' };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logConnectionError('Health check falló', error);
      return { status: 'down', message };
    }
  }

  async close(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.client = null;
      console.log('[redis] Conexión cerrada');
    }
  }
}

export const redis = new RedisClient();

export function getRedis(): RedisConnection {
  return redis.getClient();
}
