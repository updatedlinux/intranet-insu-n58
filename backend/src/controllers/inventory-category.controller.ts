import type { NextFunction, Request, Response } from 'express';
import type { AppError } from '../middlewares/error.middleware';
import {
  createAssetCategoryService,
  createConsumableCategoryService,
  deleteAssetCategoryService,
  deleteConsumableCategoryService,
  getAssetCategoryService,
  getConsumableCategoryService,
  listAssetCategoriesAdminService,
  listConsumableCategoriesAdminService,
  updateAssetCategoryService,
  updateConsumableCategoryService,
} from '../services/inventory-category.service';
import {
  parseCategoryNameFilter,
  validateAssetCategoryBody,
  validateConsumableCategoryBody,
} from '../validators/inventory-category.validator';

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

export async function listAssetCategoriesAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(
      await listAssetCategoriesAdminService(
        parseCategoryNameFilter(req.query as Record<string, unknown>),
      ),
    );
  } catch (e) {
    next(e);
  }
}

export async function getAssetCategoryAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await getAssetCategoryService(parseIdParam(req.params.id)));
  } catch (e) {
    next(e);
  }
}

export async function createAssetCategoryAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    const body = validateAssetCategoryBody(req.body as Record<string, unknown>);
    res.status(201).json(await createAssetCategoryService(body));
  } catch (e) {
    next(e);
  }
}

export async function updateAssetCategoryAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    const body = validateAssetCategoryBody(req.body as Record<string, unknown>);
    res.json(await updateAssetCategoryService(parseIdParam(req.params.id), body));
  } catch (e) {
    next(e);
  }
}

export async function deleteAssetCategoryAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    await deleteAssetCategoryService(parseIdParam(req.params.id));
    res.status(204).send();
  } catch (e) {
    next(e);
  }
}

export async function listConsumableCategoriesAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    res.json(
      await listConsumableCategoriesAdminService(
        parseCategoryNameFilter(req.query as Record<string, unknown>),
      ),
    );
  } catch (e) {
    next(e);
  }
}

export async function getConsumableCategoryAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await getConsumableCategoryService(parseIdParam(req.params.id)));
  } catch (e) {
    next(e);
  }
}

export async function createConsumableCategoryAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const body = validateConsumableCategoryBody(req.body as Record<string, unknown>);
    res.status(201).json(await createConsumableCategoryService(body));
  } catch (e) {
    next(e);
  }
}

export async function updateConsumableCategoryAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const body = validateConsumableCategoryBody(req.body as Record<string, unknown>);
    res.json(await updateConsumableCategoryService(parseIdParam(req.params.id), body));
  } catch (e) {
    next(e);
  }
}

export async function deleteConsumableCategoryAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    await deleteConsumableCategoryService(parseIdParam(req.params.id));
    res.status(204).send();
  } catch (e) {
    next(e);
  }
}
