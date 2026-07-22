import type { NextFunction, Request, Response } from 'express';
import type { AppError } from '../middlewares/error.middleware';
import {
  addMaintenanceService,
  assignAssetService,
  createAssetService,
  getAssetDetailService,
  listAssetCategoriesService,
  listAssetsService,
  listUserAssetsService,
  unassignAssetService,
  updateAssetService,
  updateAssetStatusService,
} from '../services/asset.service';
import {
  parseAssetListQuery,
  validateAssignAssetBody,
  validateAssetStatusBody,
  validateCreateAssetBody,
  validateMaintenanceBody,
  validateUpdateAssetBody,
} from '../validators/asset.validator';

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

export async function listAssetCategories(_req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await listAssetCategoriesService());
  } catch (e) {
    next(e);
  }
}

export async function createAsset(req: Request, res: Response, next: NextFunction) {
  try {
    if (!requireUser(req, res)) return;
    const body = validateCreateAssetBody(req.body as Record<string, unknown>);
    const result = await createAssetService(req.user, body);
    res.status(201).json(result);
  } catch (e) {
    next(e);
  }
}

export async function listAssets(req: Request, res: Response, next: NextFunction) {
  try {
    const q = parseAssetListQuery(req.query as Record<string, unknown>);
    res.json(await listAssetsService(q));
  } catch (e) {
    next(e);
  }
}

export async function getAsset(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await getAssetDetailService(parseIdParam(req.params.id)));
  } catch (e) {
    next(e);
  }
}

export async function updateAsset(req: Request, res: Response, next: NextFunction) {
  try {
    const body = validateUpdateAssetBody(req.body as Record<string, unknown>);
    res.json(await updateAssetService(parseIdParam(req.params.id), body));
  } catch (e) {
    next(e);
  }
}

export async function assignAsset(req: Request, res: Response, next: NextFunction) {
  try {
    if (!requireUser(req, res)) return;
    const body = validateAssignAssetBody(req.body as Record<string, unknown>);
    res.json(await assignAssetService(req.user, parseIdParam(req.params.id), body));
  } catch (e) {
    next(e);
  }
}

export async function unassignAsset(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await unassignAssetService(parseIdParam(req.params.id)));
  } catch (e) {
    next(e);
  }
}

export async function patchAssetStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const { status } = validateAssetStatusBody(req.body as Record<string, unknown>);
    res.json(await updateAssetStatusService(parseIdParam(req.params.id), status));
  } catch (e) {
    next(e);
  }
}

export async function addMaintenance(req: Request, res: Response, next: NextFunction) {
  try {
    if (!requireUser(req, res)) return;
    const body = validateMaintenanceBody(req.body as Record<string, unknown>);
    res.status(201).json(await addMaintenanceService(req.user, parseIdParam(req.params.id), body));
  } catch (e) {
    next(e);
  }
}

export async function listUserAssets(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await listUserAssetsService(parseIdParam(req.params.userId)));
  } catch (e) {
    next(e);
  }
}
