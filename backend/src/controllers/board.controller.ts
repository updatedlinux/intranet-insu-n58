import type { NextFunction, Request, Response } from 'express';
import {
  createBoardColumnService,
  deleteBoardColumnService,
  getBoardDetailService,
  getBoardMetricsService,
  listMyBoardsService,
  reorderBoardColumnsService,
  updateBoardColumnService,
} from '../services/board.service';
import { parseIdParam } from '../validators/collaborator.validator';
import {
  validateCreateColumnBody,
  validateReorderColumnsBody,
  validateUpdateColumnBody,
} from '../validators/board.validator';

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

export async function listMyBoards(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!requireUser(req, res)) return;
    const result = await listMyBoardsService(req.user);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function getBoard(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!requireUser(req, res)) return;
    const boardId = parseIdParam(req.params.boardId);
    const result = await getBoardDetailService(req.user, boardId);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function getBoardMetrics(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!requireUser(req, res)) return;
    const boardId = parseIdParam(req.params.boardId);
    const metrics = await getBoardMetricsService(req.user, boardId);
    res.json(metrics);
  } catch (error) {
    next(error);
  }
}

export async function createBoardColumn(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!requireUser(req, res)) return;
    const boardId = parseIdParam(req.params.boardId);
    const body = validateCreateColumnBody(req.body as Record<string, unknown>);
    const column = await createBoardColumnService(req.user, boardId, body);
    res.status(201).json({ item: column });
  } catch (error) {
    next(error);
  }
}

export async function updateBoardColumn(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!requireUser(req, res)) return;
    const boardId = parseIdParam(req.params.boardId);
    const columnId = parseIdParam(req.params.columnId);
    const body = validateUpdateColumnBody(req.body as Record<string, unknown>);
    const column = await updateBoardColumnService(req.user, boardId, columnId, body);
    res.json({ item: column });
  } catch (error) {
    next(error);
  }
}

export async function reorderBoardColumns(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!requireUser(req, res)) return;
    const boardId = parseIdParam(req.params.boardId);
    const body = validateReorderColumnsBody(req.body as Record<string, unknown>);
    await reorderBoardColumnsService(req.user, boardId, body.columns);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
}

export async function deleteBoardColumn(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!requireUser(req, res)) return;
    const boardId = parseIdParam(req.params.boardId);
    const columnId = parseIdParam(req.params.columnId);
    await deleteBoardColumnService(req.user, boardId, columnId);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}
