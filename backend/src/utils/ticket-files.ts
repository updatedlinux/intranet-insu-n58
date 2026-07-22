import { randomUUID } from 'node:crypto';

export const TICKET_ATTACHMENT_MAX_BYTES = 20 * 1024 * 1024;
export const TICKET_ATTACHMENT_MAX_FILES = 5;

export const ALLOWED_TICKET_ATTACHMENT_MIMES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/svg+xml',
]);

const EXT_BY_MIME: Record<string, string> = {
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/svg+xml': 'svg',
};

const ALLOWED_EXTENSIONS = new Set(['pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png', 'svg']);

export interface TicketUploadFile {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
}

export function formatTicketAttachmentMaxSizeLabel(): string {
  return '20 MB';
}

export function resolveTicketAttachmentExtension(mimeType: string, originalName?: string): string {
  const fromMime = EXT_BY_MIME[mimeType.toLowerCase()];
  if (fromMime) return fromMime;

  const match = originalName?.match(/\.([a-z0-9]+)$/i);
  return match ? match[1]!.toLowerCase() : 'bin';
}

export function isAllowedTicketAttachmentExtension(originalName: string): boolean {
  const match = originalName.match(/\.([a-z0-9]+)$/i);
  if (!match) return false;
  return ALLOWED_EXTENSIONS.has(match[1]!.toLowerCase());
}

export function validateTicketAttachmentMimeType(mimeType: string, originalName: string): boolean {
  const normalized = mimeType.toLowerCase();
  if (ALLOWED_TICKET_ATTACHMENT_MIMES.has(normalized)) return true;
  return isAllowedTicketAttachmentExtension(originalName);
}

export function buildTicketAttachmentFileKey(extension: string): string {
  const safeExt = extension.replace(/[^a-z0-9]/gi, '') || 'bin';
  return `tickets/${randomUUID()}.${safeExt}`;
}

export function validateTicketAttachments(files: TicketUploadFile[]): void {
  if (files.length > TICKET_ATTACHMENT_MAX_FILES) {
    throw new Error(`Puede adjuntar hasta ${TICKET_ATTACHMENT_MAX_FILES} archivos`);
  }

  for (const file of files) {
    if (file.size > TICKET_ATTACHMENT_MAX_BYTES) {
      throw new Error(
        `"${file.originalname}" supera el tamaño máximo de ${formatTicketAttachmentMaxSizeLabel()}`,
      );
    }
    if (!validateTicketAttachmentMimeType(file.mimetype, file.originalname)) {
      throw new Error(`"${file.originalname}" no es un tipo permitido (PDF, Word, JPG, PNG o SVG)`);
    }
  }
}
