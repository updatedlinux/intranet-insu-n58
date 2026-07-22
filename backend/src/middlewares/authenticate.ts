import type { NextFunction, Request, Response } from 'express';
import { getAuthCookieName } from '../utils/cookies';
import { verifyAccessToken } from '../utils/jwt';
import { getAuthenticatedUser } from '../services/auth.service';
import { isSessionActive } from '../services/session.service';
import type { AppError } from './error.middleware';

export async function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const token = req.cookies?.[getAuthCookieName()] as string | undefined;

    if (!token) {
      const error = new Error('No autenticado') as AppError;
      error.statusCode = 401;
      throw error;
    }

    const payload = verifyAccessToken(token);

    const sessionValid = await isSessionActive(payload.sub, payload.jti);
    if (!sessionValid) {
      const error = new Error('Sesión cerrada o expirada') as AppError;
      error.statusCode = 401;
      throw error;
    }

    req.user = await getAuthenticatedUser(payload.sub);
    next();
  } catch (error) {
    if (error instanceof Error && 'statusCode' in error) {
      next(error);
      return;
    }

    const authError = new Error('Token inválido o expirado') as AppError;
    authError.statusCode = 401;
    next(authError);
  }
}
