import type { NextFunction, Request, Response } from 'express';
import {
  getUnreadCount,
  getUserNotifications,
  markAllAsRead,
  markAsRead,
} from '../services/notification.service';
import { registerSseClient, unregisterSseClient } from '../services/sse.service';
import { parseIdParam } from '../validators/collaborator.validator';

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

export async function streamNotifications(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!requireUser(req, res)) return;

    const userId = req.user.id;
    registerSseClient(userId, res);

    req.on('close', () => {
      unregisterSseClient(userId, res);
    });
  } catch (error) {
    next(error);
  }
}

export async function listNotifications(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!requireUser(req, res)) return;
    const items = await getUserNotifications(req.user.id);
    res.json({ items });
  } catch (error) {
    next(error);
  }
}

export async function unreadCount(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!requireUser(req, res)) return;
    const count = await getUnreadCount(req.user.id);
    res.json({ count });
  } catch (error) {
    next(error);
  }
}

export async function markNotificationRead(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!requireUser(req, res)) return;
    const id = parseIdParam(req.params.id);
    const item = await markAsRead(id, req.user.id);
    res.json({ item });
  } catch (error) {
    next(error);
  }
}

export async function markAllNotificationsRead(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!requireUser(req, res)) return;
    await markAllAsRead(req.user.id);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
}
