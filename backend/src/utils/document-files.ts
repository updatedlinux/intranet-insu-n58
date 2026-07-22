import { randomUUID } from 'node:crypto';

export const DOCUMENT_MAX_BYTES = 20 * 1024 * 1024;

export const ALLOWED_DOCUMENT_MIMES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'text/plain',
]);

const EXT_BY_MIME: Record<string, string> = {
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.ms-powerpoint': 'ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'text/plain': 'txt',
};

export function validateDocumentMimeType(mimeType: string): boolean {
  return ALLOWED_DOCUMENT_MIMES.has(mimeType.toLowerCase());
}

export function resolveDocumentExtension(mimeType: string, originalName?: string): string {
  const fromMime = EXT_BY_MIME[mimeType.toLowerCase()];
  if (fromMime) return fromMime;

  const match = originalName?.match(/\.([a-z0-9]+)$/i);
  return match ? match[1]!.toLowerCase() : 'bin';
}

export function buildDocumentFileKey(extension: string): string {
  const safeExt = extension.replace(/[^a-z0-9]/gi, '') || 'bin';
  return `documents/${randomUUID()}.${safeExt}`;
}

export function formatDocumentMaxSizeLabel(): string {
  return '20 MB';
}

export type DocumentFileKind = 'pdf' | 'word' | 'excel' | 'image' | 'other';

export function classifyFileKind(mimeType: string, fileName?: string): DocumentFileKind {
  const mime = mimeType.toLowerCase();
  if (mime === 'application/pdf') return 'pdf';
  if (mime.includes('word') || mime === 'application/msword' || fileName?.match(/\.docx?$/i)) {
    return 'word';
  }
  if (
    mime.includes('excel') ||
    mime.includes('spreadsheet') ||
    mime === 'application/vnd.ms-excel' ||
    fileName?.match(/\.xlsx?$/i)
  ) {
    return 'excel';
  }
  if (mime.startsWith('image/')) return 'image';
  return 'other';
}
