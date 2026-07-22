import type { NextFunction, Request, Response } from 'express';
import {
  createChatAreaAccessService,
  deleteChatAreaAccessService,
  getChatAreaAccessService,
  listChatAreaAccessService,
  updateChatAreaAccessService,
} from '../services/chat-area-access.service';
import { parseIdParam } from '../validators/collaborator.validator';
import { validateChatAreaAccessBody } from '../validators/chat-area-access.validator';

function requireUser(
  req: Request,
  res: Response,
): req is Request & { user: NonNullable<Request['user']> } {
  if (!req.user) {
    res.status(401).json({ error: { message: 'No autenticado' } });
    return false;
  }
  return true;
}

export async function listChatAreaAccess(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!requireUser(req, res)) return;
    const query = req.query as Record<string, unknown>;
    const filters: { userId?: number; areaId?: number; isActive?: boolean } = {};
    if (typeof query.userId === 'string') {
      filters.userId = Number.parseInt(query.userId, 10);
    }
    if (typeof query.areaId === 'string') {
      filters.areaId = Number.parseInt(query.areaId, 10);
    }
    if (query.isActive === 'true') filters.isActive = true;
    if (query.isActive === 'false') filters.isActive = false;
    const result = await listChatAreaAccessService(filters);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function getChatAreaAccess(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!requireUser(req, res)) return;
    const id = parseIdParam(req.params.id);
    const item = await getChatAreaAccessService(id);
    res.json({ item });
  } catch (error) {
    next(error);
  }
}

export async function createChatAreaAccess(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!requireUser(req, res)) return;
    const data = validateChatAreaAccessBody(req.body as Record<string, unknown>);
    const item = await createChatAreaAccessService(data);
    res.status(201).json({ item });
  } catch (error) {
    next(error);
  }
}

export async function updateChatAreaAccess(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!requireUser(req, res)) return;
    const id = parseIdParam(req.params.id);
    const data = validateChatAreaAccessBody(req.body as Record<string, unknown>);
    const item = await updateChatAreaAccessService(id, data);
    res.json({ item });
  } catch (error) {
    next(error);
  }
}

export async function deleteChatAreaAccess(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!requireUser(req, res)) return;
    const id = parseIdParam(req.params.id);
    await deleteChatAreaAccessService(id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}
