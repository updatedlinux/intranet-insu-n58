import type { NextFunction, Request, Response } from 'express';
import { isAdminRole } from '../constants/roles';
import {
  archiveAnnouncementService,
  createAnnouncementService,
  getAnnouncementService,
  listLatestAnnouncementsService,
  listManageAnnouncementsService,
  listPublishedAnnouncementsService,
  publishAnnouncementService,
  updateAnnouncementService,
  uploadAnnouncementImageService,
  getAnnouncementCapabilitiesService,
} from '../services/announcement.service';
import { parseIdParam } from '../validators/collaborator.validator';
import {
  parseAnnouncementListQuery,
  validateAnnouncementBody,
} from '../validators/announcement.validator';

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

export async function listAnnouncements(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!requireUser(req, res)) return;
    const filters = parseAnnouncementListQuery(req.query as Record<string, unknown>);
    const result = isAdminRole(req.user.roleName)
      ? await listManageAnnouncementsService(req.user, filters)
      : await listPublishedAnnouncementsService(req.user, filters);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function listLatestAnnouncements(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!requireUser(req, res)) return;
    const filters = parseAnnouncementListQuery(req.query as Record<string, unknown>);
    const result = await listLatestAnnouncementsService(req.user, filters.limit ?? 3);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function listManageAnnouncements(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!requireUser(req, res)) return;
    const filters = parseAnnouncementListQuery(req.query as Record<string, unknown>);
    const result = await listManageAnnouncementsService(req.user, filters);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function getAnnouncement(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!requireUser(req, res)) return;
    const id = parseIdParam(req.params.id);
    const item = await getAnnouncementService(req.user, id);
    res.json({ item });
  } catch (error) {
    next(error);
  }
}

export async function createAnnouncement(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!requireUser(req, res)) return;
    const data = validateAnnouncementBody(req.body as Record<string, unknown>);
    const item = await createAnnouncementService(req.user, data);
    res.status(201).json({ item });
  } catch (error) {
    next(error);
  }
}

export async function updateAnnouncement(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!requireUser(req, res)) return;
    const id = parseIdParam(req.params.id);
    const data = validateAnnouncementBody(req.body as Record<string, unknown>);
    const item = await updateAnnouncementService(req.user, id, data);
    res.json({ item });
  } catch (error) {
    next(error);
  }
}

export async function publishAnnouncement(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!requireUser(req, res)) return;
    const id = parseIdParam(req.params.id);
    const item = await publishAnnouncementService(req.user, id);
    res.json({ item });
  } catch (error) {
    next(error);
  }
}

export async function archiveAnnouncement(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!requireUser(req, res)) return;
    const id = parseIdParam(req.params.id);
    const item = await archiveAnnouncementService(req.user, id);
    res.json({ item });
  } catch (error) {
    next(error);
  }
}

export async function uploadAnnouncementImage(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!requireUser(req, res)) return;
    if (!req.file) {
      res.status(400).json({ error: { message: 'Debe enviar un archivo en el campo "image"' } });
      return;
    }
    const result = await uploadAnnouncementImageService(req.user, {
      buffer: req.file.buffer,
      mimetype: req.file.mimetype,
      originalname: req.file.originalname,
    });
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

export async function announcementCapabilities(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: { message: 'No autenticado' } });
      return;
    }
    const caps = await getAnnouncementCapabilitiesService(req.user);
    res.json(caps);
  } catch (error) {
    next(error);
  }
}
