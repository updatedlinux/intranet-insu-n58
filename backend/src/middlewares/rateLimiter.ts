import type { NextFunction, Request, Response } from 'express';
import {
  isLoginBlocked,
  LOGIN_RATE_LIMIT,
  normalizeLoginEmail,
} from '../services/login-rate-limit.service';
import type { AppError } from './error.middleware';

/**
 * Bloquea login si el email superó el límite de intentos fallidos (Redis).
 * Aplicar únicamente a POST /auth/login.
 */
export async function loginRateLimiter(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const email = (req.body as { email?: string })?.email ?? '';
    const normalized = normalizeLoginEmail(email);

    if (normalized && (await isLoginBlocked(normalized))) {
      const error = new Error(
        `Demasiados intentos fallidos. Espere ${LOGIN_RATE_LIMIT.windowMinutes} minutos antes de volver a intentar.`,
      ) as AppError;
      error.statusCode = 429;
      next(error);
      return;
    }

    next();
  } catch (error) {
    next(error);
  }
}
