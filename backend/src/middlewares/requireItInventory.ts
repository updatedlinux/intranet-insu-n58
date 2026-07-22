import type { NextFunction, Request, Response } from 'express';
import { canAccessItInventory } from '../policies/inventory-access.policy';

export function requireItInventory(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ message: 'No autenticado' });
    return;
  }
  if (!canAccessItInventory(req.user)) {
    res.status(403).json({ message: 'Acceso exclusivo del área de TI' });
    return;
  }
  next();
}
