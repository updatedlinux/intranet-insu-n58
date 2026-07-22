import type { NextFunction, Request, Response } from 'express';
import type { AppError } from '../middlewares/error.middleware';
import {
  createRequestService,
  getRequestService,
  linkRequestTaskService,
  listInboxRequestsService,
  listMyRequestsService,
  listTargetAreasService,
  updateRequestStatusService,
} from '../services/request.service';
import {
  parseRequestListQuery,
  validateCreateRequestBody,
  validateLinkTaskBody,
  validateUpdateRequestStatusBody,
} from '../validators/request.validator';

function requireUser(
  req: Request,
  res: Response,
): req is Request & { user: NonNullable<Request['user']> } {
  if (!req.user) {
    res.status(401).json({ message: 'No autenticado' });
    return false;
  }
  return true;
}

function parseIdParam(value: string | string[]): number {
  const raw = Array.isArray(value) ? value[0] : value;
  const id = Number.parseInt(raw ?? '', 10);
  if (!Number.isInteger(id) || id <= 0) {
    const err = new Error('ID inválido') as AppError;
    err.statusCode = 400;
    throw err;
  }
  return id;
}

export async function listTargetAreas(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!requireUser(req, res)) return;
    const result = await listTargetAreasService();
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function createRequest(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!requireUser(req, res)) return;
    const body = validateCreateRequestBody(req.body as Record<string, unknown>);
    const item = await createRequestService(req.user, body);
    res.status(201).json({ item });
  } catch (error) {
    next(error);
  }
}

export async function listMyRequests(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!requireUser(req, res)) return;
    const query = parseRequestListQuery(req.query as Record<string, unknown>);
    const result = await listMyRequestsService(req.user, query);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function listInboxRequests(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!requireUser(req, res)) return;
    const query = parseRequestListQuery(req.query as Record<string, unknown>);
    const result = await listInboxRequestsService(req.user, {
      status: query.status,
      priority: query.priority,
      requesterId: query.requesterId,
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function getRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!requireUser(req, res)) return;
    const id = parseIdParam(req.params.id);
    const result = await getRequestService(req.user, id);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function updateRequestStatus(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!requireUser(req, res)) return;
    const id = parseIdParam(req.params.id);
    const body = validateUpdateRequestStatusBody(req.body as Record<string, unknown>);
    const result = await updateRequestStatusService(req.user, id, body);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function linkRequestTask(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!requireUser(req, res)) return;
    const id = parseIdParam(req.params.id);
    const body = validateLinkTaskBody(req.body as Record<string, unknown>);
    const result = await linkRequestTaskService(req.user, id, body.linkedTaskId);
    res.json(result);
  } catch (error) {
    next(error);
  }
}
