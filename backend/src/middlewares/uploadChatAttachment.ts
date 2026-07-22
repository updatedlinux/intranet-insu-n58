import multer from 'multer';
import type { NextFunction, Request, Response } from 'express';
import { CHAT_ATTACHMENT_MAX_BYTES } from '../constants/chat';
import type { AppError } from './error.middleware';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: CHAT_ATTACHMENT_MAX_BYTES, files: 1 },
});

export const chatUploadMiddleware = upload.single('file');

export function handleChatUploadError(
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
        ? 'El adjunto no puede superar 10 MB'
        : 'Error al procesar el archivo',
    ) as AppError;
    error.statusCode = 400;
    next(error);
    return;
  }
  next(err);
}
