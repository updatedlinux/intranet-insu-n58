import sql from 'mssql';
import { config } from './index';

class DatabasePool {
  private pool: sql.ConnectionPool | null = null;
  private connectPromise: Promise<sql.ConnectionPool> | null = null;
  private shuttingDown = false;

  private buildSqlConfig(): sql.config {
    return {
      server: config.db.server,
      port: config.db.port,
      database: config.db.database,
      user: config.db.user,
      password: config.db.password,
      options: {
        encrypt: config.db.encrypt,
        trustServerCertificate: !config.db.encrypt,
      },
      pool: {
        max: 10,
        min: 1,
        idleTimeoutMillis: 60_000,
      },
    };
  }

  markShuttingDown(): void {
    this.shuttingDown = true;
  }

  /** Reinicia flags al arrancar (hot-reload ts-node-dev puede reutilizar el módulo). */
  prepareForStartup(): void {
    this.shuttingDown = false;
    this.connectPromise = null;
  }

  isShuttingDown(): boolean {
    return this.shuttingDown;
  }

  isConnected(): boolean {
    return !this.shuttingDown && Boolean(this.pool?.connected);
  }

  /**
   * Garantiza pool activo para jobs/API. Reintenta conexión si se perdió
   * (timeout, hot-reload, corte de red) salvo durante shutdown.
   */
  async ensureConnected(): Promise<boolean> {
    if (this.shuttingDown) return false;
    if (this.pool?.connected) return true;

    if (this.pool) {
      try {
        await this.pool.close();
      } catch {
        /* pool ya cerrado */
      }
      this.pool = null;
    }

    try {
      await this.connect();
      return this.isConnected();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('[database] No se pudo restablecer el pool:', message);
      return false;
    }
  }

  async connect(): Promise<void> {
    if (this.shuttingDown) {
      return;
    }

    if (this.pool?.connected) {
      return;
    }

    if (this.pool) {
      try {
        await this.pool.close();
      } catch {
        /* pool ya cerrado o inaccesible */
      }
      this.pool = null;
    }

    if (this.connectPromise) {
      await this.connectPromise;
      return;
    }

    const sqlConfig = this.buildSqlConfig();

    console.log(
      `[database] Conectando a SQL Server ${config.db.server}:${config.db.port}/${config.db.database} (${config.env})...`,
    );

    this.connectPromise = new sql.ConnectionPool(sqlConfig).connect();

    try {
      this.pool = await this.connectPromise;
      this.pool.on('error', (err) => {
        console.error('[database] Error en el pool:', err instanceof Error ? err.message : err);
      });
      console.log('[database] Pool de conexiones listo');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('[database] Error de conexión a SQL Server:', message);
      if (error instanceof Error && error.stack && config.isDevelopment) {
        console.error(error.stack);
      }
      throw error;
    } finally {
      this.connectPromise = null;
    }
  }

  getPool(): sql.ConnectionPool {
    if (this.shuttingDown) {
      throw new Error('[database] Aplicación en proceso de cierre.');
    }
    if (!this.pool?.connected) {
      throw new Error(
        '[database] El pool no está inicializado. Ejecute database.connect() al arrancar la aplicación.',
      );
    }
    return this.pool;
  }

  async ping(): Promise<{ status: 'up' | 'down'; message?: string }> {
    try {
      const ready = await this.ensureConnected();
      if (!ready || !this.pool?.connected) {
        return { status: 'down', message: 'Pool no conectado' };
      }
      await this.pool.request().query('SELECT 1 AS health');
      return { status: 'up' };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('[database] Health check falló:', message);
      return { status: 'down', message };
    }
  }

  async close(): Promise<void> {
    this.shuttingDown = true;
    if (this.pool) {
      await this.pool.close();
      this.pool = null;
      console.log('[database] Pool cerrado');
    }
  }
}

/** Singleton del pool de SQL Server */
export const database = new DatabasePool();

/** Acceso al pool para consultas en servicios */
export function getPool(): sql.ConnectionPool {
  return database.getPool();
}
