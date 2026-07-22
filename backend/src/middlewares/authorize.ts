import type { NextFunction, Request, Response } from 'express';
import type { AppError } from './error.middleware';

export function authorize(...allowedRoles: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      const error = new Error('No autenticado') as AppError;
      error.statusCode = 401;
      next(error);
      return;
    }

    if (!allowedRoles.includes(req.user.roleName)) {
      const error = new Error('No tiene permisos para esta acción') as AppError;
      error.statusCode = 403;
      next(error);
      return;
    }

    next();
  };
}
