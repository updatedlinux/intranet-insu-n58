import type { NextFunction, Request, Response } from 'express';
import { database } from '../config/database';

/**
 * Verifica/reestablece el pool antes de atender la petición.
 * Health check se excluye para poder reportar estado degradado.
 */
export async function ensureDatabaseMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  if (req.originalUrl.includes('/health')) {
    next();
    return;
  }

  const ready = await database.ensureConnected();
  if (!ready) {
    res.status(503).json({
      error: { message: 'Base de datos temporalmente no disponible. Intente de nuevo.' },
    });
    return;
  }

  next();
}
