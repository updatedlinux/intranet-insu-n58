import multer from 'multer';
import type { NextFunction, Request, Response } from 'express';
import {
  ASSET_PHOTO_MAX_BYTES,
  formatAssetPhotoMaxSizeLabel,
} from '../services/asset-photo-storage.service';
import type { AppError } from './error.middleware';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: ASSET_PHOTO_MAX_BYTES, files: 1 },
});

export const assetPhotoUploadMiddleware = upload.single('photo');

export function handleAssetPhotoUploadError(
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
        ? `La imagen no puede superar ${formatAssetPhotoMaxSizeLabel()}`
        : 'Error al procesar el archivo subido',
    ) as AppError;
    error.statusCode = 400;
    next(error);
    return;
  }

  next(err);
}
