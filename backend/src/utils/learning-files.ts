import type { LearningContentType } from '../constants/learning';

const VIDEO_MIMES = new Set(['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo']);

const PDF_MIMES = new Set(['application/pdf']);

const IMAGE_MIMES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
]);

const DOCUMENT_MIMES = new Set([
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
]);

export function inferContentTypeFromMime(mime: string): LearningContentType | null {
  if (VIDEO_MIMES.has(mime)) return 'VIDEO';
  if (PDF_MIMES.has(mime)) return 'PDF';
  if (IMAGE_MIMES.has(mime)) return 'IMAGE';
  if (DOCUMENT_MIMES.has(mime)) return 'DOCUMENT';
  return null;
}

export function contentTypeToMime(contentType: LearningContentType, fileName?: string): string {
  const ext = fileName?.split('.').pop()?.toLowerCase();
  switch (contentType) {
    case 'VIDEO':
      if (ext === 'webm') return 'video/webm';
      return 'video/mp4';
    case 'PDF':
      return 'application/pdf';
    case 'IMAGE':
      if (ext === 'png') return 'image/png';
      if (ext === 'gif') return 'image/gif';
      if (ext === 'webp') return 'image/webp';
      if (ext === 'svg') return 'image/svg+xml';
      return 'image/jpeg';
    default:
      return 'application/octet-stream';
  }
}

export function validateLessonMime(mime: string): boolean {
  return inferContentTypeFromMime(mime) != null;
}

export function validateCoverMime(mime: string): boolean {
  return IMAGE_MIMES.has(mime);
}

export function formatLearningMaxSizeLabel(): string {
  return '500 MB';
}
