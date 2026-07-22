import type { NextFunction, Request, Response } from 'express';
import type { AppError } from '../middlewares/error.middleware';
import {
  getOrCreateDirectRoomService,
  getRoomMessagesService,
  getUnreadCountService,
  listUserRoomsService,
  streamChatFileService,
  uploadChatAttachmentService,
} from '../services/chat.service';

function parseId(v: string | string[]): number {
  const raw = Array.isArray(v) ? v[0] : v;
  const id = Number.parseInt(raw ?? '', 10);
  if (!Number.isInteger(id) || id <= 0) {
    const e = new Error('ID inválido') as AppError;
    e.statusCode = 400;
    throw e;
  }
  return id;
}

export async function listRooms(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await listUserRoomsService(req.user!);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function getUnreadCount(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const count = await getUnreadCountService(req.user!.id);
    res.json({ count });
  } catch (error) {
    next(error);
  }
}

export async function getMessages(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const roomId = parseId(req.params.roomId);
    const beforeRaw = req.query.beforeId;
    const beforeId =
      typeof beforeRaw === 'string' && beforeRaw ? Number.parseInt(beforeRaw, 10) : undefined;
    const limitRaw = req.query.limit;
    const limit =
      typeof limitRaw === 'string' && limitRaw ? Number.parseInt(limitRaw, 10) : undefined;
    const result = await getRoomMessagesService(req.user!, roomId, beforeId, limit);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function createDirectRoom(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const body = req.body as { userId?: number };
    const targetUserId = Number(body.userId);
    if (!Number.isInteger(targetUserId) || targetUserId <= 0) {
      const error = new Error('userId inválido') as AppError;
      error.statusCode = 400;
      throw error;
    }
    const result = await getOrCreateDirectRoomService(req.user!, targetUserId);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

export async function uploadAttachment(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.file) {
      const error = new Error('Debe enviar un archivo en el campo "file"') as AppError;
      error.statusCode = 400;
      throw error;
    }
    const roomId = Number(req.body?.roomId);
    if (!Number.isInteger(roomId) || roomId <= 0) {
      const error = new Error('roomId es obligatorio') as AppError;
      error.statusCode = 400;
      throw error;
    }
    const result = await uploadChatAttachmentService(req.user!, roomId, {
      buffer: req.file.buffer,
      mimetype: req.file.mimetype,
      originalname: req.file.originalname,
    });
    res.json({
      fileUrl: result.fileKey,
      fileName: result.fileName,
      fileType: result.fileType,
    });
  } catch (error) {
    next(error);
  }
}

export async function streamFile(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const messageId = parseId(req.params.messageId);
    const { stream, contentType } = await streamChatFileService(req.user!, messageId);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    stream.on('error', (err) => next(err));
    stream.pipe(res);
  } catch (error) {
    next(error);
  }
}
