import multer from 'multer';
import type { NextFunction, Request, Response } from 'express';
import {
  ALLOWED_TICKET_ATTACHMENT_MIMES,
  formatTicketAttachmentMaxSizeLabel,
  isAllowedTicketAttachmentExtension,
  TICKET_ATTACHMENT_MAX_BYTES,
  TICKET_ATTACHMENT_MAX_FILES,
} from '../utils/ticket-files';
import type { AppError } from './error.middleware';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: TICKET_ATTACHMENT_MAX_BYTES, files: TICKET_ATTACHMENT_MAX_FILES },
  fileFilter: (_req, file, cb) => {
    const mime = file.mimetype.toLowerCase();
    if (
      ALLOWED_TICKET_ATTACHMENT_MIMES.has(mime) ||
      isAllowedTicketAttachmentExtension(file.originalname)
    ) {
      cb(null, true);
      return;
    }
    cb(new Error('Tipo de archivo no permitido. Use PDF, Word, JPG, PNG o SVG.'));
  },
});

export const ticketAttachmentsUploadMiddleware = upload.array('files', TICKET_ATTACHMENT_MAX_FILES);

export function handleTicketAttachmentUploadError(
  err: unknown,
  _req: Request,
  _res: Response,
  next: NextFunction,
): void {
  if (!err) {
    next();
    return;
  }

  if (err instanceof multer.MulterError) {
    let message = 'Error al procesar los archivos adjuntos';
    if (err.code === 'LIMIT_FILE_SIZE') {
      message = `Cada archivo no puede superar ${formatTicketAttachmentMaxSizeLabel()}`;
    } else if (err.code === 'LIMIT_FILE_COUNT') {
      message = `Puede adjuntar hasta ${TICKET_ATTACHMENT_MAX_FILES} archivos`;
    }
    const error = new Error(message) as AppError;
    error.statusCode = 400;
    next(error);
    return;
  }

  if (err instanceof Error) {
    const error = new Error(err.message) as AppError;
    error.statusCode = 400;
    next(error);
    return;
  }

  next(err);
}

export function wrapTicketCreateUpload(req: Request, res: Response, next: NextFunction): void {
  const contentType = req.headers['content-type'] ?? '';
  if (!contentType.includes('multipart/form-data')) {
    next();
    return;
  }

  ticketAttachmentsUploadMiddleware(req, res, (err) => {
    if (err) {
      handleTicketAttachmentUploadError(err, req, res, next);
      return;
    }
    next();
  });
}
