import type { NextFunction, Request, Response } from 'express';
import { canManageLearning } from '../policies/learning-access.policy';
import type { AppError } from './error.middleware';

export function requireLearningManager(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) {
    const error = new Error('No autenticado') as AppError;
    error.statusCode = 401;
    next(error);
    return;
  }

  if (!canManageLearning(req.user)) {
    const error = new Error('No tiene permisos para gestionar Insular Learning') as AppError;
    error.statusCode = 403;
    next(error);
    return;
  }

  next();
}
