import type { NextFunction, Request, Response } from 'express';
import type { AppError } from '../middlewares/error.middleware';
import {
  deleteConsumablePhotoService,
  serveConsumablePhotoService,
  uploadConsumablePhotoService,
} from '../services/consumable-photo.service';

function parseIdParam(v: string | string[]): number {
  const raw = Array.isArray(v) ? v[0] : v;
  const id = Number.parseInt(raw ?? '', 10);
  if (!Number.isInteger(id) || id <= 0) {
    const e = new Error('ID inválido') as AppError;
    e.statusCode = 400;
    throw e;
  }
  return id;
}

export async function serveConsumablePhoto(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const consumableId = parseIdParam(req.params.id);
    const { stream, contentType } = await serveConsumablePhotoService(consumableId);

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    stream.on('error', (err) => {
      next(err);
    });
    stream.pipe(res);
  } catch (error) {
    next(error);
  }
}

export async function uploadConsumablePhoto(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.file) {
      const error = new Error('Debe enviar un archivo en el campo "photo"') as AppError;
      error.statusCode = 400;
      throw error;
    }

    const consumableId = parseIdParam(req.params.id);
    const result = await uploadConsumablePhotoService(consumableId, {
      buffer: req.file.buffer,
      mimetype: req.file.mimetype,
      originalname: req.file.originalname,
      size: req.file.size,
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function deleteConsumablePhoto(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const consumableId = parseIdParam(req.params.id);
    await deleteConsumablePhotoService(consumableId);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}
