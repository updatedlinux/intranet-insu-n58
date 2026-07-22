import type { Request, Response, NextFunction } from 'express';
import {
  findActiveAreas,
  findActiveRoles,
  findActivePositionsByArea,
} from '../repositories/catalog.repository';
import { getAssignableRolesForActor } from '../services/collaborator.service';

export async function listRoles(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const actorRole = req.user?.roleName ?? '';
    const assignable = getAssignableRolesForActor(actorRole);
    const roles = await findActiveRoles();
    res.json({ roles: roles.filter((r) => assignable.includes(r.name)) });
  } catch (error) {
    next(error);
  }
}

export async function listAreas(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const areas = await findActiveAreas();
    res.json({ areas });
  } catch (error) {
    next(error);
  }
}

export async function listPositions(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const areaIdRaw = req.query.areaId;
    let areaId: number | undefined;
    if (typeof areaIdRaw === 'string' && areaIdRaw) {
      areaId = Number.parseInt(areaIdRaw, 10);
      if (Number.isNaN(areaId)) {
        res.status(400).json({ error: { message: 'areaId inválido' } });
        return;
      }
    }
    const positions = await findActivePositionsByArea(areaId);
    res.json({ positions });
  } catch (error) {
    next(error);
  }
}
