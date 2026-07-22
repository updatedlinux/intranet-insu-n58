import { randomUUID } from 'node:crypto';

export const TASK_ATTACHMENT_MAX_BYTES = 20 * 1024 * 1024;
export const TASK_ATTACHMENT_MAX_FILES = 5;

export const ALLOWED_TASK_ATTACHMENT_MIMES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
]);

const EXT_BY_MIME: Record<string, string> = {
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

const ALLOWED_EXTENSIONS = new Set([
  'pdf',
  'doc',
  'docx',
  'xls',
  'xlsx',
  'jpg',
  'jpeg',
  'png',
  'webp',
  'gif',
]);

export interface TaskUploadFile {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
}

export function formatTaskAttachmentMaxSizeLabel(): string {
  return '20 MB';
}

export function resolveTaskAttachmentExtension(mimeType: string, originalName?: string): string {
  const fromMime = EXT_BY_MIME[mimeType.toLowerCase()];
  if (fromMime) return fromMime;

  const match = originalName?.match(/\.([a-z0-9]+)$/i);
  return match ? match[1]!.toLowerCase() : 'bin';
}

export function isAllowedTaskAttachmentExtension(originalName: string): boolean {
  const match = originalName.match(/\.([a-z0-9]+)$/i);
  if (!match) return false;
  return ALLOWED_EXTENSIONS.has(match[1]!.toLowerCase());
}

export function validateTaskAttachmentMimeType(mimeType: string, originalName: string): boolean {
  const normalized = mimeType.toLowerCase();
  if (ALLOWED_TASK_ATTACHMENT_MIMES.has(normalized)) return true;
  return isAllowedTaskAttachmentExtension(originalName);
}

export function buildTaskAttachmentFileKey(taskId: number, extension: string): string {
  const safeExt = extension.replace(/[^a-z0-9]/gi, '') || 'bin';
  return `tasks/${taskId}/${randomUUID()}.${safeExt}`;
}

export function validateTaskAttachment(file: TaskUploadFile): void {
  if (file.size > TASK_ATTACHMENT_MAX_BYTES) {
    throw new Error(
      `"${file.originalname}" supera el tamaño máximo de ${formatTaskAttachmentMaxSizeLabel()}`,
    );
  }
  if (!validateTaskAttachmentMimeType(file.mimetype, file.originalname)) {
    throw new Error(`"${file.originalname}" no es un tipo permitido (PDF, Word, Excel o imagen)`);
  }
}
