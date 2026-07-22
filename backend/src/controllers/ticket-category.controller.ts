import type { NextFunction, Request, Response } from 'express';
import {
  createTicketCategoryService,
  deleteTicketCategoryService,
  getTicketCategoryService,
  listTicketCategoriesService,
  toggleTicketCategoryService,
  updateTicketCategoryService,
} from '../services/ticket-category.service';
import { parseIdParam } from '../validators/collaborator.validator';
import {
  parseTicketCategoryListQuery,
  validateTicketCategoryBody,
} from '../validators/ticket-category.validator';

export async function listTicketCategoriesHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const filters = parseTicketCategoryListQuery(req.query as Record<string, unknown>);
    const result = await listTicketCategoriesService(filters);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function getTicketCategoryHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const id = parseIdParam(req.params.id);
    const item = await getTicketCategoryService(id);
    res.json({ item });
  } catch (error) {
    next(error);
  }
}

export async function createTicketCategoryHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const body = validateTicketCategoryBody(req.body as Record<string, unknown>);
    const item = await createTicketCategoryService(body);
    res.status(201).json({ item });
  } catch (error) {
    next(error);
  }
}

export async function updateTicketCategoryHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const id = parseIdParam(req.params.id);
    const body = validateTicketCategoryBody(req.body as Record<string, unknown>);
    const item = await updateTicketCategoryService(id, body);
    res.json({ item });
  } catch (error) {
    next(error);
  }
}

export async function toggleTicketCategoryHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const id = parseIdParam(req.params.id);
    const isActive = Boolean((req.body as { isActive?: boolean }).isActive);
    const item = await toggleTicketCategoryService(id, isActive);
    res.json({ item });
  } catch (error) {
    next(error);
  }
}

export async function deleteTicketCategoryHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const id = parseIdParam(req.params.id);
    await deleteTicketCategoryService(id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}
