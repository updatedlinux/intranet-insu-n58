import multer from 'multer';
import type { NextFunction, Request, Response } from 'express';
import { LEARNING_COVER_MAX_BYTES, LEARNING_LESSON_MAX_BYTES } from '../constants/learning';
import { formatLearningMaxSizeLabel } from '../utils/learning-files';
import type { AppError } from './error.middleware';

const lessonUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: LEARNING_LESSON_MAX_BYTES, files: 30 },
});

const coverUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: LEARNING_COVER_MAX_BYTES, files: 1 },
});

export const learningLessonsUploadMiddleware = lessonUpload.array('files', 30);
export const learningCoverUploadMiddleware = coverUpload.single('cover');

function handleMulterError(err: unknown, next: NextFunction): void {
  if (err instanceof multer.MulterError) {
    const error = new Error(
      err.code === 'LIMIT_FILE_SIZE'
        ? `El archivo no puede superar ${formatLearningMaxSizeLabel()}`
        : 'Error al procesar el archivo subido',
    ) as AppError;
    error.statusCode = 400;
    next(error);
    return;
  }
  next(err);
}

export function handleLearningLessonsUploadError(
  err: unknown,
  _req: Request,
  _res: Response,
  next: NextFunction,
): void {
  if (!err) {
    next();
    return;
  }
  handleMulterError(err, next);
}

export function handleLearningCoverUploadError(
  err: unknown,
  _req: Request,
  _res: Response,
  next: NextFunction,
): void {
  if (!err) {
    next();
    return;
  }
  handleMulterError(err, next);
}
