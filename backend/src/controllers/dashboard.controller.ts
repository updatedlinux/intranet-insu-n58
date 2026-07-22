import type { NextFunction, Request, Response } from 'express';
import { getDashboardService } from '../services/dashboard.service';

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

export async function getDashboard(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!requireUser(req, res)) return;
    const payload = await getDashboardService(req.user);
    res.json(payload);
  } catch (error) {
    next(error);
  }
}
