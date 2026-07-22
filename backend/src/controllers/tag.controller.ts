import type { NextFunction, Request, Response } from 'express';
import {
  createTagService,
  deleteTagService,
  getTagService,
  listTagsService,
  toggleTagService,
  updateTagService,
} from '../services/tag.service';
import {
  parseTagListQuery,
  validateTagBody,
  validateTagToggleBody,
} from '../validators/tag.validator';
import { parseIdParam } from '../validators/collaborator.validator';

export async function listTagsHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const filters = parseTagListQuery(req.query as Record<string, unknown>);
    const items = await listTagsService(filters);
    res.json({ items });
  } catch (error) {
    next(error);
  }
}

export async function getTagHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const id = parseIdParam(req.params.id);
    const tag = await getTagService(id);
    res.json({ tag });
  } catch (error) {
    next(error);
  }
}

export async function createTagHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const data = validateTagBody(req.body as Record<string, unknown>);
    const tag = await createTagService(data);
    res.status(201).json({ tag });
  } catch (error) {
    next(error);
  }
}

export async function updateTagHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const id = parseIdParam(req.params.id);
    const data = validateTagBody(req.body as Record<string, unknown>);
    const tag = await updateTagService(id, data);
    res.json({ tag });
  } catch (error) {
    next(error);
  }
}

export async function toggleTagHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const id = parseIdParam(req.params.id);
    const isActive = validateTagToggleBody(req.body as Record<string, unknown>);
    const tag = await toggleTagService(id, isActive);
    res.json({ tag });
  } catch (error) {
    next(error);
  }
}

export async function deleteTagHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const id = parseIdParam(req.params.id);
    await deleteTagService(id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}
