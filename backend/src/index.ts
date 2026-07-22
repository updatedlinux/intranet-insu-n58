import { createServer } from 'node:http';
import { config } from './config';
import { database } from './config/database';
import { redis } from './config/redis';
import { mailer } from './config/mailer';
import { storage } from './config/storage';
import { createApp } from './app';
import {
  startTaskDueReminderScheduler,
  stopTaskDueReminderScheduler,
} from './services/task-due-reminder.service';
import { startMeetingReminderJobs, stopMeetingReminderJobs } from './jobs/meetingReminders.job';
import { startInventoryLowStockJob, stopInventoryLowStockJob } from './jobs/inventoryLowStock.job';
import { stopAllCronJobs } from './jobs/cron-registry';
import { initSocketServer, closeSocketServer } from './socket';
import { syncAllAreaMirrorFolders } from './services/area-folder-sync.service';

let shutdownStarted = false;

const SHUTDOWN_TIMEOUT_MS = config.isDevelopment ? 3_000 : 10_000;

async function bootstrap(): Promise<void> {
  database.prepareForStartup();

  try {
    await database.connect();
    await storage.initialize();
    await redis.connect();
    void mailer.verifyConnection();
  } catch (error) {
    console.error('[bootstrap] No se pudo inicializar la infraestructura:', error);
    process.exit(1);
  }

  const app = createApp();
  const httpServer = createServer(app);
  initSocketServer(httpServer);

  httpServer.listen(config.port, '0.0.0.0', () => {
    console.log(`[server] Intranet API en http://0.0.0.0:${config.port}`);
    console.log(`[server] Ambiente: ${config.env}`);
    console.log(`[server] Health: http://localhost:${config.port}/api/v1/health`);
    console.log(`[server] Socket.io en ws://localhost:${config.port}/socket.io`);

    if (!database.isConnected()) {
      console.warn('[server] Jobs en segundo plano omitidos: pool SQL no conectado');
      return;
    }

    startTaskDueReminderScheduler();
    startMeetingReminderJobs();
    startInventoryLowStockJob();

    void syncAllAreaMirrorFolders()
      .then((count) => {
        console.log(`[server] Carpetas espejo sincronizadas para ${count} área(s)`);
      })
      .catch((error) => {
        console.error('[server] No se pudieron sincronizar carpetas espejo de áreas:', error);
      });
  });

  const shutdown = async (signal: string) => {
    if (shutdownStarted) return;
    shutdownStarted = true;

    console.log(`[server] Señal ${signal} recibida, cerrando...`);

    stopTaskDueReminderScheduler();
    stopMeetingReminderJobs();
    stopInventoryLowStockJob();
    stopAllCronJobs();
    database.markShuttingDown();

    const forceExit = setTimeout(() => {
      console.warn(`[server] Cierre forzado tras ${SHUTDOWN_TIMEOUT_MS}ms`);
      process.exit(0);
    }, SHUTDOWN_TIMEOUT_MS);
    forceExit.unref();

    try {
      await closeSocketServer();

      if (typeof httpServer.closeAllConnections === 'function') {
        httpServer.closeAllConnections();
      }

      await new Promise<void>((resolve, reject) => {
        httpServer.close((err) => (err ? reject(err) : resolve()));
      });

      await Promise.allSettled([database.close(), redis.close()]);
      clearTimeout(forceExit);
      console.log('[server] Apagado completo');
      process.exit(0);
    } catch (error) {
      console.error('[server] Error durante el apagado:', error);
      clearTimeout(forceExit);
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

void bootstrap();
