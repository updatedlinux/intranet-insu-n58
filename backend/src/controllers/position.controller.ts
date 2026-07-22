import type { NextFunction, Request, Response } from 'express';
import {
  createPositionService,
  deletePositionService,
  getPositionService,
  listPositionsService,
  togglePositionService,
  updatePositionService,
} from '../services/position.service';
import {
  parseIdParam,
  parsePositionListQuery,
  validatePositionBody,
  validateToggleBody,
} from '../validators/position.validator';

export async function listPositionsHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const filters = parsePositionListQuery(req.query as Record<string, unknown>);
    const result = await listPositionsService(filters);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function getPositionHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const id = parseIdParam(req.params.id);
    const position = await getPositionService(id);
    res.json({ position });
  } catch (error) {
    next(error);
  }
}

export async function createPositionHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const data = validatePositionBody(req.body, true);
    const position = await createPositionService(data);
    res.status(201).json({ position });
  } catch (error) {
    next(error);
  }
}

export async function updatePositionHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const id = parseIdParam(req.params.id);
    const data = validatePositionBody(req.body, false);
    const position = await updatePositionService(id, data);
    res.json({ position });
  } catch (error) {
    next(error);
  }
}

export async function togglePositionHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const id = parseIdParam(req.params.id);
    const isActive = validateToggleBody(req.body);
    const position = await togglePositionService(id, isActive);
    res.json({ position });
  } catch (error) {
    next(error);
  }
}

export async function deletePositionHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const id = parseIdParam(req.params.id);
    await deletePositionService(id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}
