import type { NextFunction, Request, Response } from 'express';
import { listDirectoryService } from '../services/directory.service';
import { parseDirectoryQuery } from '../validators/directory.validator';

export async function listDirectory(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const filters = parseDirectoryQuery(req.query as Record<string, unknown>);
    const result = await listDirectoryService(filters);
    res.json(result);
  } catch (error) {
    next(error);
  }
}
