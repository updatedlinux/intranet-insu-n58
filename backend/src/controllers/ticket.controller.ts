import type { NextFunction, Request, Response } from 'express';
import {
  addTicketCommentService,
  assignTicketService,
  createTicketService,
  serveTicketAttachmentService,
  getTicketCapabilities,
  getTicketMetricsService,
  getTicketService,
  listTicketsService,
  updateTicketPriorityService,
  updateTicketStatusService,
} from '../services/ticket.service';
import { parseIdParam } from '../validators/collaborator.validator';
import {
  parseTicketListQuery,
  validateAssignTicketBody,
  validateCommentBody,
  validateCreateTicketBody,
  validatePriorityBody,
  validateStatusBody,
} from '../validators/ticket.validator';

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

export function ticketCapabilities(req: Request, res: Response): void {
  if (!req.user) {
    res.status(401).json({ error: { message: 'No autenticado' } });
    return;
  }
  res.json(getTicketCapabilities(req.user));
}

export async function createTicket(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!requireUser(req, res)) return;
    const body = validateCreateTicketBody(req.body as Record<string, unknown>);
    const files =
      (req.files as Express.Multer.File[] | undefined)?.map((file) => ({
        buffer: file.buffer,
        originalname: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
      })) ?? [];
    const item = await createTicketService(req.user, body, files);
    res.status(201).json({ item });
  } catch (error) {
    next(error);
  }
}

export async function listTickets(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!requireUser(req, res)) return;
    const filters = parseTicketListQuery(req.query as Record<string, unknown>);
    const result = await listTicketsService(req.user, filters);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function getTicketMetrics(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!requireUser(req, res)) return;
    const metrics = await getTicketMetricsService(req.user);
    res.json(metrics);
  } catch (error) {
    next(error);
  }
}

export async function getTicket(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!requireUser(req, res)) return;
    const id = parseIdParam(req.params.id);
    const result = await getTicketService(req.user, id);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function assignTicket(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!requireUser(req, res)) return;
    const id = parseIdParam(req.params.id);
    const body = validateAssignTicketBody(req.body as Record<string, unknown>);
    const item = await assignTicketService(req.user, id, body);
    res.json({ item });
  } catch (error) {
    next(error);
  }
}

export async function patchTicketStatus(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!requireUser(req, res)) return;
    const id = parseIdParam(req.params.id);
    const { status } = validateStatusBody(req.body as Record<string, unknown>);
    const item = await updateTicketStatusService(req.user, id, status);
    res.json({ item });
  } catch (error) {
    next(error);
  }
}

export async function patchTicketPriority(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!requireUser(req, res)) return;
    const id = parseIdParam(req.params.id);
    const { priority } = validatePriorityBody(req.body as Record<string, unknown>);
    const item = await updateTicketPriorityService(req.user, id, priority);
    res.json({ item });
  } catch (error) {
    next(error);
  }
}

export async function downloadTicketAttachment(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!requireUser(req, res)) return;
    const ticketId = parseIdParam(req.params.id);
    const attachmentId = parseIdParam(req.params.attachmentId);
    const inline = req.query.action === 'view' || req.query.inline === '1';
    const result = await serveTicketAttachmentService(req.user, ticketId, attachmentId);

    const dispositionType = inline ? 'inline' : 'attachment';
    const asciiName = result.fileName.replace(/[^\w.\-() ]/g, '_') || 'adjunto';
    res.setHeader('Content-Type', result.mimeType);
    res.setHeader(
      'Content-Disposition',
      `${dispositionType}; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(result.fileName)}`,
    );
    res.setHeader('Cache-Control', 'private, max-age=300');

    if (result.buffer) {
      res.setHeader('Content-Length', String(result.buffer.length));
      res.send(result.buffer);
      return;
    }

    if (!result.stream) {
      res.status(404).json({ error: { message: 'Adjunto no disponible' } });
      return;
    }

    result.stream.on('error', (err) => {
      next(err);
    });
    result.stream.pipe(res);
  } catch (error) {
    next(error);
  }
}

export async function addTicketComment(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!requireUser(req, res)) return;
    const id = parseIdParam(req.params.id);
    const { message } = validateCommentBody(req.body as Record<string, unknown>);
    const comment = await addTicketCommentService(req.user, id, message);
    res.status(201).json({ comment });
  } catch (error) {
    next(error);
  }
}
