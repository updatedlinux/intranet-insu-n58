import { randomUUID } from 'node:crypto';
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import type { Readable } from 'node:stream';
import { storage } from '../config/storage';
import { buildAvatarPublicUrl, extractAvatarObjectKey } from '../utils/avatar-url';

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);

const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export function validateAvatarMimeType(mimeType: string): boolean {
  return ALLOWED_MIME_TYPES.has(mimeType.toLowerCase());
}

export function resolveAvatarExtension(mimeType: string, originalName?: string): string {
  const fromMime = EXT_BY_MIME[mimeType.toLowerCase()];
  if (fromMime) return fromMime;

  const match = originalName?.match(/\.(jpe?g|png|webp)$/i);
  if (match) {
    const ext = match[1]!.toLowerCase();
    return ext === 'jpeg' ? 'jpg' : ext;
  }

  return 'jpg';
}

export function buildAvatarObjectKey(userId: number, extension: string): string {
  const safeExt = extension.replace(/[^a-z0-9]/gi, '') || 'jpg';
  return `avatars/${userId}/${randomUUID()}.${safeExt}`;
}

export async function uploadAvatarObject(
  objectKey: string,
  body: Buffer,
  contentType: string,
): Promise<string> {
  const client = storage.getS3Client();
  await client.send(
    new PutObjectCommand({
      Bucket: storage.getBucketName(),
      Key: objectKey,
      Body: body,
      ContentType: contentType,
    }),
  );

  return buildAvatarPublicUrl(objectKey);
}

export async function deleteAvatarByStoredUrl(storedUrl: string | null | undefined): Promise<void> {
  if (!storedUrl?.trim()) return;

  const objectKey = extractAvatarObjectKey(storedUrl);
  if (!objectKey) {
    console.warn(`[avatar] No se pudo resolver clave de objeto para: ${storedUrl}`);
    return;
  }

  await deleteAvatarObject(objectKey);
}

function mimeTypeFromObjectKey(objectKey: string): string {
  const lower = objectKey.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  return 'image/jpeg';
}

export async function getAvatarObject(
  storedUrl: string,
): Promise<{ stream: Readable; contentType: string }> {
  const objectKey = extractAvatarObjectKey(storedUrl);
  if (!objectKey) {
    throw new Error('URL de avatar no válida');
  }

  const client = storage.getS3Client();
  const response = await client.send(
    new GetObjectCommand({
      Bucket: storage.getBucketName(),
      Key: objectKey,
    }),
  );

  if (!response.Body) {
    throw new Error('El avatar no está disponible en almacenamiento');
  }

  return {
    stream: response.Body as Readable,
    contentType: response.ContentType ?? mimeTypeFromObjectKey(objectKey),
  };
}

export async function deleteAvatarObject(objectKey: string): Promise<void> {
  const client = storage.getS3Client();
  await client.send(
    new DeleteObjectCommand({
      Bucket: storage.getBucketName(),
      Key: objectKey,
    }),
  );
}

export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;

export function formatAvatarMaxSizeLabel(): string {
  return '2 MB';
}
