import type { NextFunction, Request, Response } from 'express';
import { canManageAnnouncements } from '../policies/announcement-access.policy';

export function requireAnnouncementManager(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: { message: 'No autenticado' } });
    return;
  }
  if (!canManageAnnouncements(req.user)) {
    res.status(403).json({ error: { message: 'No tiene permisos para gestionar comunicados' } });
    return;
  }
  next();
}
