import { randomUUID } from 'node:crypto';
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import type { Readable } from 'node:stream';
import { storage } from '../config/storage';

const ASSET_PHOTOS_PREFIX = 'inventory/assets/';
const CONSUMABLE_PHOTOS_PREFIX = 'inventory/consumables/';
const INVENTORY_PHOTOS_PREFIX = 'inventory/';

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);

const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export function validateAssetPhotoMimeType(mimeType: string): boolean {
  return ALLOWED_MIME_TYPES.has(mimeType.toLowerCase());
}

export function resolveAssetPhotoExtension(mimeType: string, originalName?: string): string {
  const fromMime = EXT_BY_MIME[mimeType.toLowerCase()];
  if (fromMime) return fromMime;

  const match = originalName?.match(/\.(jpe?g|png|webp)$/i);
  if (match) {
    const ext = match[1]!.toLowerCase();
    return ext === 'jpeg' ? 'jpg' : ext;
  }

  return 'jpg';
}

export function buildAssetPhotoObjectKey(assetId: number, extension: string): string {
  const safeExt = extension.replace(/[^a-z0-9]/gi, '') || 'jpg';
  return `${ASSET_PHOTOS_PREFIX}${assetId}/${randomUUID()}.${safeExt}`;
}

export function buildConsumablePhotoObjectKey(consumableId: number, extension: string): string {
  const safeExt = extension.replace(/[^a-z0-9]/gi, '') || 'jpg';
  return `${CONSUMABLE_PHOTOS_PREFIX}${consumableId}/${randomUUID()}.${safeExt}`;
}

export function isInventoryPhotoObjectKey(key: string): boolean {
  const trimmed = key.trim();
  return trimmed.startsWith(ASSET_PHOTOS_PREFIX) || trimmed.startsWith(CONSUMABLE_PHOTOS_PREFIX);
}

/** @deprecated Use isInventoryPhotoObjectKey */
export function isAssetPhotoObjectKey(key: string): boolean {
  return isInventoryPhotoObjectKey(key);
}

export async function uploadAssetPhotoObject(
  objectKey: string,
  body: Buffer,
  contentType: string,
): Promise<void> {
  const client = storage.getS3Client();
  await client.send(
    new PutObjectCommand({
      Bucket: storage.getBucketName(),
      Key: objectKey,
      Body: body,
      ContentType: contentType,
    }),
  );
}

function mimeTypeFromObjectKey(objectKey: string): string {
  const lower = objectKey.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  return 'image/jpeg';
}

export async function getInventoryPhotoObject(
  imageKey: string,
): Promise<{ stream: Readable; contentType: string }> {
  const objectKey = imageKey.trim();
  if (!objectKey.startsWith(INVENTORY_PHOTOS_PREFIX)) {
    throw new Error('Clave de imagen no válida');
  }

  const client = storage.getS3Client();
  const response = await client.send(
    new GetObjectCommand({
      Bucket: storage.getBucketName(),
      Key: objectKey,
    }),
  );

  if (!response.Body) {
    throw new Error('La imagen no está disponible en almacenamiento');
  }

  return {
    stream: response.Body as Readable,
    contentType: response.ContentType ?? mimeTypeFromObjectKey(objectKey),
  };
}

/** @deprecated Use getInventoryPhotoObject */
export const getAssetPhotoObject = getInventoryPhotoObject;

export async function deleteInventoryPhotoObject(imageKey: string): Promise<void> {
  const objectKey = imageKey.trim();
  if (!objectKey) return;

  const client = storage.getS3Client();
  await client.send(
    new DeleteObjectCommand({
      Bucket: storage.getBucketName(),
      Key: objectKey,
    }),
  );
}

/** @deprecated Use deleteInventoryPhotoObject */
export const deleteAssetPhotoObject = deleteInventoryPhotoObject;

export const INVENTORY_PHOTO_MAX_BYTES = 3 * 1024 * 1024;

/** @deprecated Use INVENTORY_PHOTO_MAX_BYTES */
export const ASSET_PHOTO_MAX_BYTES = INVENTORY_PHOTO_MAX_BYTES;

export function formatInventoryPhotoMaxSizeLabel(): string {
  return '3 MB';
}

/** @deprecated Use formatInventoryPhotoMaxSizeLabel */
export const formatAssetPhotoMaxSizeLabel = formatInventoryPhotoMaxSizeLabel;
