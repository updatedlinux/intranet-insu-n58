import type { NextFunction, Request, Response } from 'express';
import type { AppError } from '../middlewares/error.middleware';
import {
  deleteAssetPhotoService,
  serveAssetPhotoService,
  uploadAssetPhotoService,
} from '../services/asset-photo.service';

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

export async function serveAssetPhoto(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const assetId = parseIdParam(req.params.id);
    const { stream, contentType } = await serveAssetPhotoService(assetId);

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

export async function uploadAssetPhoto(
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

    const assetId = parseIdParam(req.params.id);
    const result = await uploadAssetPhotoService(assetId, {
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

export async function deleteAssetPhoto(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const assetId = parseIdParam(req.params.id);
    await deleteAssetPhotoService(assetId);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}
