import type { NextFunction, Request, Response } from 'express';
import {
  createAreaService,
  deleteAreaService,
  getAreaDeletePreviewService,
  getAreaService,
  listAreasService,
  toggleAreaService,
  updateAreaService,
} from '../services/area.service';
import {
  parseAreaListQuery,
  parseIdParam,
  validateAreaBody,
  validateAreaDeleteBody,
  validateToggleBody,
} from '../validators/area.validator';

export async function listAreasHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const filters = parseAreaListQuery(req.query as Record<string, unknown>);
    const result = await listAreasService(filters);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function getAreaHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const id = parseIdParam(req.params.id);
    const area = await getAreaService(id);
    res.json({ area });
  } catch (error) {
    next(error);
  }
}

export async function createAreaHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const data = validateAreaBody(req.body, true);
    const area = await createAreaService(data);
    res.status(201).json({ area });
  } catch (error) {
    next(error);
  }
}

export async function updateAreaHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const id = parseIdParam(req.params.id);
    const data = validateAreaBody(req.body, false);
    const area = await updateAreaService(id, data);
    res.json({ area });
  } catch (error) {
    next(error);
  }
}

export async function toggleAreaHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const id = parseIdParam(req.params.id);
    const isActive = validateToggleBody(req.body);
    const area = await toggleAreaService(id, isActive);
    res.json({ area });
  } catch (error) {
    next(error);
  }
}

export async function getAreaDeletePreviewHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const id = parseIdParam(req.params.id);
    const preview = await getAreaDeletePreviewService(id);
    res.json({ preview });
  } catch (error) {
    next(error);
  }
}

export async function deleteAreaHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const id = parseIdParam(req.params.id);
    const options = validateAreaDeleteBody(req.body ?? {});
    await deleteAreaService(id, options);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}
