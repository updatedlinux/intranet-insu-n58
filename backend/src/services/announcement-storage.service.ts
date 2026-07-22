import { randomUUID } from 'node:crypto';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { storage } from '../config/storage';
import { getSignedDownloadUrl } from './document-storage.service';

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);

const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

const MAX_BYTES = 5 * 1024 * 1024;

export function validateAnnouncementImageMimeType(mimeType: string): boolean {
  return ALLOWED_MIME_TYPES.has(mimeType.toLowerCase());
}

export function resolveAnnouncementImageExtension(mimeType: string, originalName?: string): string {
  const fromMime = EXT_BY_MIME[mimeType.toLowerCase()];
  if (fromMime) return fromMime;
  const match = originalName?.match(/\.(jpe?g|png|webp)$/i);
  if (match) {
    const ext = match[1]!.toLowerCase();
    return ext === 'jpeg' ? 'jpg' : ext;
  }
  return 'jpg';
}

export function buildAnnouncementImageKey(extension: string): string {
  const safeExt = extension.replace(/[^a-z0-9]/gi, '') || 'jpg';
  return `announcements/${randomUUID()}.${safeExt}`;
}

export async function uploadAnnouncementImage(
  buffer: Buffer,
  mimeType: string,
  originalName?: string,
): Promise<string> {
  if (!buffer.length) throw new Error('Imagen vacía');
  if (buffer.length > MAX_BYTES) throw new Error('La imagen no puede superar 5 MB');
  if (!validateAnnouncementImageMimeType(mimeType)) {
    throw new Error('Formato no permitido. Use JPG, PNG o WebP');
  }

  const key = buildAnnouncementImageKey(resolveAnnouncementImageExtension(mimeType, originalName));
  const client = storage.getS3Client();
  await client.send(
    new PutObjectCommand({
      Bucket: storage.getBucketName(),
      Key: key,
      Body: buffer,
      ContentType: mimeType,
    }),
  );
  return key;
}

export async function resolveAnnouncementImageUrl(
  storedKey: string | null | undefined,
): Promise<string | null> {
  if (!storedKey?.trim()) return null;
  try {
    return await getSignedDownloadUrl(storedKey.trim(), 60 * 60);
  } catch {
    return null;
  }
}
