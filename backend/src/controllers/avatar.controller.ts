import type { NextFunction, Request, Response } from 'express';
import {
  uploadUserAvatarService,
  deleteUserAvatarService,
  serveUserAvatarService,
} from '../services/avatar.service';
import { parseIdParam } from '../validators/collaborator.validator';
import type { AppError } from '../middlewares/error.middleware';

export async function serveAvatar(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: { message: 'No autenticado' } });
      return;
    }

    const userId = parseIdParam(req.params.id);
    const { stream, contentType } = await serveUserAvatarService(req.user, userId);

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

export async function uploadAvatar(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: { message: 'No autenticado' } });
      return;
    }

    const userId = parseIdParam(req.params.id);

    if (!req.file) {
      const error = new Error('Debe enviar un archivo en el campo "avatar"') as AppError;
      error.statusCode = 400;
      throw error;
    }

    const result = await uploadUserAvatarService(req.user, userId, {
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

export async function deleteAvatar(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: { message: 'No autenticado' } });
      return;
    }

    const userId = parseIdParam(req.params.id);
    const result = await deleteUserAvatarService(req.user, userId);
    res.json(result);
  } catch (error) {
    next(error);
  }
}
