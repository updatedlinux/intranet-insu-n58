import type { Response } from 'express';
import type { PublicNotification } from '../types/notification';

type SseClient = {
  res: Response;
  heartbeatTimer: ReturnType<typeof setInterval>;
};

const clientsByUser = new Map<number, Set<SseClient>>();

const HEARTBEAT_MS = 30_000;

function writeEvent(res: Response, event: string, data: unknown): void {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

export function registerSseClient(userId: number, res: Response): void {
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  writeEvent(res, 'connected', { userId });

  const heartbeatTimer = setInterval(() => {
    if (!res.writableEnded) {
      writeEvent(res, 'heartbeat', { ts: Date.now() });
    }
  }, HEARTBEAT_MS);

  const client: SseClient = { res, heartbeatTimer };
  let bucket = clientsByUser.get(userId);
  if (!bucket) {
    bucket = new Set();
    clientsByUser.set(userId, bucket);
  }
  bucket.add(client);
}

export function unregisterSseClient(userId: number, res: Response): void {
  const bucket = clientsByUser.get(userId);
  if (!bucket) return;

  for (const client of bucket) {
    if (client.res === res) {
      clearInterval(client.heartbeatTimer);
      bucket.delete(client);
      break;
    }
  }

  if (bucket.size === 0) {
    clientsByUser.delete(userId);
  }
}

export function broadcastToUser(userId: number, notification: PublicNotification): void {
  const bucket = clientsByUser.get(userId);
  if (!bucket || bucket.size === 0) return;

  for (const client of [...bucket]) {
    if (client.res.writableEnded) {
      clearInterval(client.heartbeatTimer);
      bucket.delete(client);
      continue;
    }
    try {
      writeEvent(client.res, 'notification', notification);
    } catch {
      clearInterval(client.heartbeatTimer);
      bucket.delete(client);
    }
  }

  if (bucket.size === 0) {
    clientsByUser.delete(userId);
  }
}

/** Solo para pruebas/diagnóstico en desarrollo */
export function getActiveSseConnectionCount(): number {
  let total = 0;
  for (const bucket of clientsByUser.values()) {
    total += bucket.size;
  }
  return total;
}
