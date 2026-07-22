import multer from 'multer';
import type { NextFunction, Request, Response } from 'express';
import { DOCUMENT_MAX_BYTES, formatDocumentMaxSizeLabel } from '../utils/document-files';
import type { AppError } from './error.middleware';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: DOCUMENT_MAX_BYTES, files: 1 },
});

export const documentUploadMiddleware = upload.single('file');

export function handleDocumentUploadError(
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
        ? `El archivo no puede superar ${formatDocumentMaxSizeLabel()}`
        : 'Error al procesar el archivo subido',
    ) as AppError;
    error.statusCode = 400;
    next(error);
    return;
  }

  next(err);
}

export function wrapDocumentUpload(req: Request, res: Response, next: NextFunction): void {
  documentUploadMiddleware(req, res, (err) => {
    if (err) {
      handleDocumentUploadError(err, req, res, next);
      return;
    }
    next();
  });
}
