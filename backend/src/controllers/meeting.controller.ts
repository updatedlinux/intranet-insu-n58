import type { NextFunction, Request, Response } from 'express';
import {
  cancelMeetingService,
  completeMeetingService,
  createMeetingService,
  getMeetingDetailService,
  listMeetingsService,
  respondMeetingService,
  updateMeetingService,
} from '../services/meeting.service';
import { parseIdParam } from '../validators/collaborator.validator';
import {
  parseMeetingListQuery,
  validateCancelMeetingBody,
  validateCreateMeetingBody,
  validateRespondMeetingBody,
  validateUpdateMeetingBody,
} from '../validators/meeting.validator';

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

export async function createMeeting(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!requireUser(req, res)) return;
    const body = validateCreateMeetingBody(req.body as Record<string, unknown>);
    const item = await createMeetingService(req.user, body);
    res.status(201).json({ item });
  } catch (error) {
    next(error);
  }
}

export async function listMeetings(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!requireUser(req, res)) return;
    const filters = parseMeetingListQuery(req.query as Record<string, unknown>);
    const result = await listMeetingsService(req.user, filters);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function getMeeting(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!requireUser(req, res)) return;
    const meetingId = parseIdParam(req.params.meetingId);
    const item = await getMeetingDetailService(req.user, meetingId);
    res.json({ item });
  } catch (error) {
    next(error);
  }
}

export async function updateMeeting(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!requireUser(req, res)) return;
    const meetingId = parseIdParam(req.params.meetingId);
    const body = validateUpdateMeetingBody(req.body as Record<string, unknown>);
    const item = await updateMeetingService(req.user, meetingId, body);
    res.json({ item });
  } catch (error) {
    next(error);
  }
}

export async function cancelMeeting(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!requireUser(req, res)) return;
    const meetingId = parseIdParam(req.params.meetingId);
    const body = validateCancelMeetingBody(req.body as Record<string, unknown>);
    const item = await cancelMeetingService(req.user, meetingId, body.cancellationReason);
    res.json({ item });
  } catch (error) {
    next(error);
  }
}

export async function respondMeeting(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!requireUser(req, res)) return;
    const meetingId = parseIdParam(req.params.meetingId);
    const userId = parseIdParam(req.params.userId);
    const body = validateRespondMeetingBody(req.body as Record<string, unknown>);
    const item = await respondMeetingService(req.user, meetingId, userId, body.status);
    res.json({ item });
  } catch (error) {
    next(error);
  }
}

export async function completeMeeting(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!requireUser(req, res)) return;
    const meetingId = parseIdParam(req.params.meetingId);
    const item = await completeMeetingService(req.user, meetingId);
    res.json({ item });
  } catch (error) {
    next(error);
  }
}
