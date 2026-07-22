import multer from 'multer';
import type { NextFunction, Request, Response } from 'express';
import { AVATAR_MAX_BYTES, formatAvatarMaxSizeLabel } from '../services/avatar-storage.service';
import type { AppError } from './error.middleware';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: AVATAR_MAX_BYTES, files: 1 },
});

export const avatarUploadMiddleware = upload.single('avatar');

export function handleAvatarUploadError(
  err: unknown,
  _req: Request,
  _res: Response,
  next: NextFunction,
): void {
  if (!err) {
    next();
    return;
  }

  if (err instanceof multer.MulterError) {
    const error = new Error(
      err.code === 'LIMIT_FILE_SIZE'
        ? `La imagen no puede superar ${formatAvatarMaxSizeLabel()}`
        : 'Error al procesar el archivo subido',
    ) as AppError;
    error.statusCode = 400;
    next(error);
    return;
  }

  next(err);
}
