import { database } from '../config/database';

function isPoolUnavailableError(error: unknown): boolean {
  const message = (error instanceof Error ? error.message : String(error)).toLowerCase();
  return (
    message.includes('pool no está inicializado') ||
    message.includes('pool no conectado') ||
    message.includes('proceso de cierre') ||
    message.includes('aplicación en proceso de cierre')
  );
}

/**
 * Ejecuta trabajo en segundo plano solo si el pool SQL está activo.
 * Reintenta conexión si se perdió; omite silenciosamente durante shutdown/hot-reload.
 */
export async function runWhenDatabaseReady(
  logLabel: string,
  job: () => Promise<void>,
): Promise<void> {
  if (database.isShuttingDown()) {
    return;
  }

  const ready = await database.ensureConnected();
  if (!ready) {
    if (!database.isShuttingDown()) {
      console.warn(`[${logLabel}] Omitido: base de datos no disponible`);
    }
    return;
  }

  try {
    await job();
  } catch (error) {
    if (database.isShuttingDown() || isPoolUnavailableError(error)) {
      return;
    }
    console.error(`[${logLabel}]`, error);
  }
}
