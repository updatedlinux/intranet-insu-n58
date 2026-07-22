import type { NextFunction, Request, Response } from 'express';
import {
  cancelEventService,
  createEventService,
  getEventForUserService,
  getEventManageService,
  listEventsForUserService,
  listEventsManageService,
  publishEventService,
  updateEventService,
} from '../services/corporate-event.service';
import { parseIdParam } from '../validators/collaborator.validator';
import {
  parseEventListQuery,
  parseEventManageQuery,
  validateEventBody,
} from '../validators/corporate-event.validator';

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

export async function listEvents(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!requireUser(req, res)) return;
    const { tab } = parseEventListQuery(req.query as Record<string, unknown>);
    const items = await listEventsForUserService(req.user.area.id, tab);
    res.json({ items });
  } catch (error) {
    next(error);
  }
}

export async function getEvent(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!requireUser(req, res)) return;
    const id = parseIdParam(req.params.id);
    const item = await getEventForUserService(id, req.user.area.id);
    res.json({ item });
  } catch (error) {
    next(error);
  }
}

export async function listEventsManage(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!requireUser(req, res)) return;
    const filters = parseEventManageQuery(req.query as Record<string, unknown>);
    const items = await listEventsManageService(filters);
    res.json({ items });
  } catch (error) {
    next(error);
  }
}

export async function getEventManage(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!requireUser(req, res)) return;
    const id = parseIdParam(req.params.id);
    const item = await getEventManageService(id);
    res.json({ item });
  } catch (error) {
    next(error);
  }
}

export async function createEvent(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!requireUser(req, res)) return;
    const body = validateEventBody(req.body as Record<string, unknown>);
    const item = await createEventService(req.user.id, body);
    res.status(201).json({ item });
  } catch (error) {
    next(error);
  }
}

export async function updateEvent(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!requireUser(req, res)) return;
    const id = parseIdParam(req.params.id);
    const body = validateEventBody(req.body as Record<string, unknown>);
    const item = await updateEventService(id, body);
    res.json({ item });
  } catch (error) {
    next(error);
  }
}

export async function publishEvent(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!requireUser(req, res)) return;
    const id = parseIdParam(req.params.id);
    const item = await publishEventService(id);
    res.json({ item });
  } catch (error) {
    next(error);
  }
}

export async function cancelEvent(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!requireUser(req, res)) return;
    const id = parseIdParam(req.params.id);
    const item = await cancelEventService(id);
    res.json({ item });
  } catch (error) {
    next(error);
  }
}
