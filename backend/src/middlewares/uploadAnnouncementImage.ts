import multer from 'multer';
import type { NextFunction, Request, Response } from 'express';
import type { AppError } from './error.middleware';

const MAX_BYTES = 5 * 1024 * 1024;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES, files: 1 },
});

export const announcementImageUpload = upload.single('image');

export function wrapAnnouncementImageUpload(req: Request, res: Response, next: NextFunction): void {
  announcementImageUpload(req, res, (err) => {
    if (!err) {
      next();
      return;
    }
    if (err instanceof multer.MulterError) {
      const error = new Error(
        err.code === 'LIMIT_FILE_SIZE'
          ? 'La imagen no puede superar 5 MB'
          : 'Error al procesar la imagen',
      ) as AppError;
      error.statusCode = 400;
      next(error);
      return;
    }
    next(err);
  });
}
