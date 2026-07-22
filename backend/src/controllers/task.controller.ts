import type { NextFunction, Request, Response } from 'express';
import {
  addTaskCommentService,
  archiveTaskService,
  assignTaskService,
  createTaskService,
  deleteTaskAttachmentService,
  getTaskDetailService,
  moveTaskService,
  serveTaskAttachmentService,
  updateTaskService,
  uploadTaskAttachmentService,
} from '../services/task.service';
import { parseIdParam } from '../validators/collaborator.validator';
import {
  validateAssignTaskBody,
  validateCommentBody,
  validateCreateTaskBody,
  validateMoveTaskBody,
  validateUpdateTaskBody,
} from '../validators/task.validator';

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

export async function createTask(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!requireUser(req, res)) return;
    const body = validateCreateTaskBody(req.body as Record<string, unknown>);
    const item = await createTaskService(req.user, body);
    res.status(201).json({ item });
  } catch (error) {
    next(error);
  }
}

export async function getTask(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!requireUser(req, res)) return;
    const taskId = parseIdParam(req.params.taskId);
    const result = await getTaskDetailService(req.user, taskId);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function updateTask(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!requireUser(req, res)) return;
    const taskId = parseIdParam(req.params.taskId);
    const body = validateUpdateTaskBody(req.body as Record<string, unknown>);
    const item = await updateTaskService(req.user, taskId, body);
    res.json({ item });
  } catch (error) {
    next(error);
  }
}

export async function moveTask(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!requireUser(req, res)) return;
    const taskId = parseIdParam(req.params.taskId);
    const body = validateMoveTaskBody(req.body as Record<string, unknown>);
    const item = await moveTaskService(req.user, taskId, body);
    res.json({ item });
  } catch (error) {
    next(error);
  }
}

export async function assignTask(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!requireUser(req, res)) return;
    const taskId = parseIdParam(req.params.taskId);
    const body = validateAssignTaskBody(req.body as Record<string, unknown>);
    const item = await assignTaskService(req.user, taskId, body);
    res.json({ item });
  } catch (error) {
    next(error);
  }
}

export async function addTaskComment(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!requireUser(req, res)) return;
    const taskId = parseIdParam(req.params.taskId);
    const body = validateCommentBody(req.body as Record<string, unknown>);
    const comment = await addTaskCommentService(req.user, taskId, body.message);
    res.status(201).json({ item: comment });
  } catch (error) {
    next(error);
  }
}

export async function uploadTaskAttachment(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!requireUser(req, res)) return;
    const taskId = parseIdParam(req.params.taskId);
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: { message: 'Archivo requerido' } });
      return;
    }
    const item = await uploadTaskAttachmentService(req.user, taskId, {
      buffer: file.buffer,
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
    });
    res.status(201).json({ item });
  } catch (error) {
    next(error);
  }
}

export async function deleteTaskAttachment(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!requireUser(req, res)) return;
    const taskId = parseIdParam(req.params.taskId);
    const attachmentId = parseIdParam(req.params.attachmentId);
    await deleteTaskAttachmentService(req.user, taskId, attachmentId);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

export async function downloadTaskAttachment(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!requireUser(req, res)) return;
    const taskId = parseIdParam(req.params.taskId);
    const attachmentId = parseIdParam(req.params.attachmentId);
    const inline = req.query.action === 'view' || req.query.inline === '1';
    const served = await serveTaskAttachmentService(req.user, taskId, attachmentId);

    const dispositionType = inline ? 'inline' : 'attachment';
    const asciiName = served.fileName.replace(/[^\w.\-() ]/g, '_') || 'adjunto';
    res.setHeader('Content-Type', served.mimeType);
    res.setHeader(
      'Content-Disposition',
      `${dispositionType}; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(served.fileName)}`,
    );
    res.setHeader('Cache-Control', 'private, max-age=300');

    if (served.buffer) {
      res.setHeader('Content-Length', String(served.buffer.length));
      res.send(served.buffer);
      return;
    }
    if (served.stream) {
      served.stream.on('error', (err) => {
        next(err);
      });
      served.stream.pipe(res);
      return;
    }
    res.status(404).json({ error: { message: 'Adjunto no disponible' } });
  } catch (error) {
    next(error);
  }
}

export async function archiveTask(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!requireUser(req, res)) return;
    const taskId = parseIdParam(req.params.taskId);
    const item = await archiveTaskService(req.user, taskId);
    res.json({ item });
  } catch (error) {
    next(error);
  }
}
