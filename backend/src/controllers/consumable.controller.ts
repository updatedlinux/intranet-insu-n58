import type { NextFunction, Request, Response } from 'express';
import type { AppError } from '../middlewares/error.middleware';
import {
  createConsumableService,
  getConsumableDetailService,
  listConsumableCategoriesService,
  listConsumablesService,
  listTicketConsumableUsageService,
  stockAdjustService,
  stockInService,
  stockOutService,
  updateConsumableService,
} from '../services/consumable.service';
import {
  parseConsumableListQuery,
  validateCreateConsumableBody,
  validateStockAdjustBody,
  validateStockInBody,
  validateStockOutBody,
  validateUpdateConsumableBody,
} from '../validators/consumable.validator';

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

function parseIdParam(v: string | string[]): number {
  const raw = Array.isArray(v) ? v[0] : v;
  const id = Number.parseInt(raw ?? '', 10);
  if (!Number.isInteger(id) || id <= 0) {
    const e = new Error('ID inválido') as AppError;
    e.statusCode = 400;
    throw e;
  }
  return id;
}

export async function listConsumableCategories(_req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await listConsumableCategoriesService());
  } catch (e) {
    next(e);
  }
}

export async function createConsumable(req: Request, res: Response, next: NextFunction) {
  try {
    if (!requireUser(req, res)) return;
    const body = validateCreateConsumableBody(req.body as Record<string, unknown>);
    res.status(201).json(await createConsumableService(req.user, body));
  } catch (e) {
    next(e);
  }
}

export async function listConsumables(req: Request, res: Response, next: NextFunction) {
  try {
    const q = parseConsumableListQuery(req.query as Record<string, unknown>);
    res.json(await listConsumablesService(q));
  } catch (e) {
    next(e);
  }
}

export async function getConsumable(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await getConsumableDetailService(parseIdParam(req.params.id)));
  } catch (e) {
    next(e);
  }
}

export async function updateConsumable(req: Request, res: Response, next: NextFunction) {
  try {
    const body = validateUpdateConsumableBody(req.body as Record<string, unknown>);
    res.json(await updateConsumableService(parseIdParam(req.params.id), body));
  } catch (e) {
    next(e);
  }
}

export async function stockIn(req: Request, res: Response, next: NextFunction) {
  try {
    if (!requireUser(req, res)) return;
    const body = validateStockInBody(req.body as Record<string, unknown>);
    res.json(await stockInService(req.user, parseIdParam(req.params.id), body));
  } catch (e) {
    next(e);
  }
}

export async function stockOut(req: Request, res: Response, next: NextFunction) {
  try {
    if (!requireUser(req, res)) return;
    const body = validateStockOutBody(req.body as Record<string, unknown>);
    res.json(await stockOutService(req.user, parseIdParam(req.params.id), body));
  } catch (e) {
    next(e);
  }
}

export async function stockAdjust(req: Request, res: Response, next: NextFunction) {
  try {
    if (!requireUser(req, res)) return;
    const body = validateStockAdjustBody(req.body as Record<string, unknown>);
    res.json(await stockAdjustService(req.user, parseIdParam(req.params.id), body));
  } catch (e) {
    next(e);
  }
}

export async function listTicketConsumableUsage(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await listTicketConsumableUsageService(parseIdParam(req.params.ticketId)));
  } catch (e) {
    next(e);
  }
}
