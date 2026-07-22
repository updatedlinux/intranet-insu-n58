import multer from 'multer';
import type { NextFunction, Request, Response } from 'express';
import {
  ALLOWED_TASK_ATTACHMENT_MIMES,
  formatTaskAttachmentMaxSizeLabel,
  isAllowedTaskAttachmentExtension,
  TASK_ATTACHMENT_MAX_BYTES,
  TASK_ATTACHMENT_MAX_FILES,
} from '../utils/task-files';
import type { AppError } from './error.middleware';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: TASK_ATTACHMENT_MAX_BYTES, files: TASK_ATTACHMENT_MAX_FILES },
  fileFilter: (_req, file, cb) => {
    const mime = file.mimetype.toLowerCase();
    if (
      ALLOWED_TASK_ATTACHMENT_MIMES.has(mime) ||
      isAllowedTaskAttachmentExtension(file.originalname)
    ) {
      cb(null, true);
      return;
    }
    cb(new Error('Tipo de archivo no permitido. Use PDF, Word, Excel o imagen.'));
  },
});

export const taskAttachmentsUploadMiddleware = upload.single('file');

export function handleTaskAttachmentUploadError(
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
    let message = 'Error al procesar el archivo adjunto';
    if (err.code === 'LIMIT_FILE_SIZE') {
      message = `El archivo no puede superar ${formatTaskAttachmentMaxSizeLabel()}`;
    }
    const error = new Error(message) as AppError;
    error.statusCode = 400;
    next(error);
    return;
  }

  if (err instanceof Error) {
    const error = new Error(err.message) as AppError;
    error.statusCode = 400;
    next(error);
    return;
  }

  next(err);
}

export function wrapTaskAttachmentUpload(req: Request, res: Response, next: NextFunction): void {
  taskAttachmentsUploadMiddleware(req, res, (err) => {
    if (err) {
      handleTaskAttachmentUploadError(err, req, res, next);
      return;
    }
    next();
  });
}
