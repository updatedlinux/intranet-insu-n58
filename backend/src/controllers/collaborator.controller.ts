import type { Request, Response, NextFunction } from 'express';
import {
  createCollaboratorService,
  deleteCollaboratorService,
  getCollaboratorService,
  listCollaboratorsService,
  resetCollaboratorPasswordService,
  setCollaboratorStatusService,
  updateCollaboratorService,
} from '../services/collaborator.service';
import { getAuditContext } from '../utils/audit-context';
import {
  parseIdParam,
  parseListQuery,
  validateCollaboratorBody,
  validateStatusBody,
} from '../validators/collaborator.validator';

export async function listCollaborators(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const filters = parseListQuery(req.query as Record<string, unknown>);
    const result = await listCollaboratorsService(filters);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function getCollaborator(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const id = parseIdParam(req.params.id);
    const collaborator = await getCollaboratorService(id);
    res.json({ collaborator });
  } catch (error) {
    next(error);
  }
}

export async function createCollaborator(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: { message: 'No autenticado' } });
      return;
    }
    const data = validateCollaboratorBody(req.body, true);
    const result = await createCollaboratorService(req.user, data, getAuditContext(req));
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

export async function updateCollaborator(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: { message: 'No autenticado' } });
      return;
    }
    const id = parseIdParam(req.params.id);
    const data = validateCollaboratorBody(req.body, false);
    const collaborator = await updateCollaboratorService(req.user, id, data, getAuditContext(req));
    res.json({ collaborator });
  } catch (error) {
    next(error);
  }
}

export async function setCollaboratorStatus(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: { message: 'No autenticado' } });
      return;
    }
    const id = parseIdParam(req.params.id);
    const isActive = validateStatusBody(req.body);
    const collaborator = await setCollaboratorStatusService(
      req.user,
      id,
      isActive,
      getAuditContext(req),
    );
    res.json({ collaborator });
  } catch (error) {
    next(error);
  }
}

export async function resetCollaboratorPassword(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: { message: 'No autenticado' } });
      return;
    }
    const id = parseIdParam(req.params.id);
    const result = await resetCollaboratorPasswordService(req.user, id, getAuditContext(req));
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function deleteCollaborator(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: { message: 'No autenticado' } });
      return;
    }
    const id = parseIdParam(req.params.id);
    await deleteCollaboratorService(req.user, id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}
