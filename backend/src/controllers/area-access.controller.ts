import type { NextFunction, Request, Response } from 'express';
import {
  createAreaAccessService,
  deleteAreaAccessService,
  getAreaAccessService,
  listAreaAccessService,
  updateAreaAccessService,
} from '../services/area-access.service';
import { parseIdParam } from '../validators/collaborator.validator';
import { validateAreaAccessBody } from '../validators/area-access.validator';

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

export async function listAreaAccess(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!requireUser(req, res)) return;
    const query = req.query as Record<string, unknown>;
    const filters: { sourceAreaId?: number; targetAreaId?: number; isActive?: boolean } = {};
    if (typeof query.sourceAreaId === 'string') {
      filters.sourceAreaId = Number.parseInt(query.sourceAreaId, 10);
    }
    if (typeof query.targetAreaId === 'string') {
      filters.targetAreaId = Number.parseInt(query.targetAreaId, 10);
    }
    if (query.isActive === 'true') filters.isActive = true;
    if (query.isActive === 'false') filters.isActive = false;
    const result = await listAreaAccessService(filters);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function getAreaAccess(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!requireUser(req, res)) return;
    const id = parseIdParam(req.params.id);
    const item = await getAreaAccessService(id);
    res.json({ item });
  } catch (error) {
    next(error);
  }
}

export async function createAreaAccess(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!requireUser(req, res)) return;
    const data = validateAreaAccessBody(req.body as Record<string, unknown>);
    const item = await createAreaAccessService(data);
    res.status(201).json({ item });
  } catch (error) {
    next(error);
  }
}

export async function updateAreaAccess(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!requireUser(req, res)) return;
    const id = parseIdParam(req.params.id);
    const data = validateAreaAccessBody(req.body as Record<string, unknown>);
    const item = await updateAreaAccessService(id, data);
    res.json({ item });
  } catch (error) {
    next(error);
  }
}

export async function deleteAreaAccess(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!requireUser(req, res)) return;
    const id = parseIdParam(req.params.id);
    await deleteAreaAccessService(id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}
