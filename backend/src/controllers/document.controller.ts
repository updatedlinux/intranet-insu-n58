import type { NextFunction, Request, Response } from 'express';
import { DOCUMENT_LOG_ACTIONS } from '../constants/document-log-actions';
import {
  approveDocumentService,
  browseFolderService,
  createFolderService,
  deleteDocumentService,
  deleteFolderService,
  listMyUploadsService,
  listPendingDocumentsService,
  listRejectedDocumentsService,
  rejectDocumentService,
  serveDocumentService,
  uploadDocumentService,
} from '../services/document.service';
import { getAuditContext } from '../utils/audit-context';
import {
  parseBrowseQuery,
  parseIdParam,
  validateCreateFolderBody,
  validateRejectDocumentBody,
  validateUploadDocumentFields,
} from '../validators/document.validator';
import type { AppError } from '../middlewares/error.middleware';

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

function parseDownloadAction(query: Record<string, unknown>): 'DOWNLOAD' | 'VIEW' {
  const raw = query.action;
  if (raw === 'view' || raw === 'VIEW') {
    return DOCUMENT_LOG_ACTIONS.VIEW;
  }
  return DOCUMENT_LOG_ACTIONS.DOWNLOAD;
}

function isInlineDownload(query: Record<string, unknown>): boolean {
  return query.action === 'view' || query.action === 'VIEW' || query.inline === '1';
}

export async function browseRootFolder(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!requireUser(req, res)) return;
    const filters = parseBrowseQuery(req.query as Record<string, unknown>);
    const result = await browseFolderService(req.user, null, filters);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function browseFolder(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!requireUser(req, res)) return;
    const folderId = parseIdParam(req.params.id);
    const filters = parseBrowseQuery(req.query as Record<string, unknown>);
    const result = await browseFolderService(req.user, folderId, filters);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function createFolder(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!requireUser(req, res)) return;
    const data = validateCreateFolderBody(req.body as Record<string, unknown>);
    const folder = await createFolderService(req.user, data);
    res.status(201).json({ folder });
  } catch (error) {
    next(error);
  }
}

export async function deleteFolder(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!requireUser(req, res)) return;
    const folderId = parseIdParam(req.params.id);
    await deleteFolderService(req.user, folderId, getAuditContext(req));
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

export async function uploadDocument(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!requireUser(req, res)) return;

    if (!req.file) {
      const error = new Error('Debe enviar un archivo en el campo "file"') as AppError;
      error.statusCode = 400;
      throw error;
    }

    const meta = validateUploadDocumentFields(req.body as Record<string, unknown>);
    const result = await uploadDocumentService(
      req.user,
      meta,
      {
        buffer: req.file.buffer,
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
      },
      getAuditContext(req),
    );

    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

export async function downloadDocument(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!requireUser(req, res)) return;
    const documentId = parseIdParam(req.params.documentId);
    const query = req.query as Record<string, unknown>;
    const action = parseDownloadAction(query);
    const inline = isInlineDownload(query);

    const served = await serveDocumentService(req.user, documentId, action, getAuditContext(req));

    const dispositionType = inline ? 'inline' : 'attachment';
    const asciiName = served.fileName.replace(/[^\w.\-() ]/g, '_') || 'documento';
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
    res.status(404).json({ error: { message: 'Documento no disponible' } });
  } catch (error) {
    next(error);
  }
}

export async function deleteDocument(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!requireUser(req, res)) return;
    const documentId = parseIdParam(req.params.documentId);
    await deleteDocumentService(req.user, documentId, getAuditContext(req));
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

export async function listPendingDocuments(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!requireUser(req, res)) return;
    const items = await listPendingDocumentsService(req.user);
    res.json({ items });
  } catch (error) {
    next(error);
  }
}

export async function listRejectedDocuments(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!requireUser(req, res)) return;
    const items = await listRejectedDocumentsService(req.user);
    res.json({ items });
  } catch (error) {
    next(error);
  }
}

export async function listMyUploads(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!requireUser(req, res)) return;
    const items = await listMyUploadsService(req.user);
    res.json({ items });
  } catch (error) {
    next(error);
  }
}

export async function approveDocument(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!requireUser(req, res)) return;
    const documentId = parseIdParam(req.params.documentId);
    const document = await approveDocumentService(req.user, documentId, getAuditContext(req));
    res.json({ document });
  } catch (error) {
    next(error);
  }
}

export async function rejectDocument(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!requireUser(req, res)) return;
    const documentId = parseIdParam(req.params.documentId);
    const { reason } = validateRejectDocumentBody(req.body as Record<string, unknown>);
    const document = await rejectDocumentService(
      req.user,
      documentId,
      reason,
      getAuditContext(req),
    );
    res.json({ document });
  } catch (error) {
    next(error);
  }
}
