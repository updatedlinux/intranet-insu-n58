import type { Readable } from 'node:stream';
import type { AppError } from '../middlewares/error.middleware';
import { findAssetById, updateAsset } from '../repositories/asset.repository';
import { buildClientAssetPhotoUrl } from '../utils/asset-photo-url';
import {
  buildAssetPhotoObjectKey,
  deleteInventoryPhotoObject,
  formatInventoryPhotoMaxSizeLabel,
  getInventoryPhotoObject,
  resolveAssetPhotoExtension,
  uploadAssetPhotoObject,
  validateAssetPhotoMimeType,
  INVENTORY_PHOTO_MAX_BYTES,
} from './asset-photo-storage.service';

export interface AssetPhotoUploadFile {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
}

function notFound(msg = 'Activo no encontrado'): AppError {
  const e = new Error(msg) as AppError;
  e.statusCode = 404;
  return e;
}

function badRequest(msg: string): AppError {
  const e = new Error(msg) as AppError;
  e.statusCode = 400;
  return e;
}

function validateUploadFile(file: AssetPhotoUploadFile): void {
  if (!file.buffer?.length) {
    throw badRequest('No se recibió ningún archivo de imagen');
  }
  if (file.size > INVENTORY_PHOTO_MAX_BYTES) {
    throw badRequest(`La imagen no puede superar ${formatInventoryPhotoMaxSizeLabel()}`);
  }
  if (!validateAssetPhotoMimeType(file.mimetype)) {
    throw badRequest('Formato no permitido. Use JPG, JPEG, PNG o WebP');
  }
}

export async function uploadAssetPhotoService(
  assetId: number,
  file: AssetPhotoUploadFile,
): Promise<{ photoUrl: string }> {
  validateUploadFile(file);

  const row = await findAssetById(assetId);
  if (!row) throw notFound();

  const previousKey = row.imageKey;
  const extension = resolveAssetPhotoExtension(file.mimetype, file.originalname);
  const objectKey = buildAssetPhotoObjectKey(assetId, extension);

  try {
    await uploadAssetPhotoObject(objectKey, file.buffer, file.mimetype);
  } catch (error) {
    console.error('[asset-photo] Error al subir a MinIO:', error);
    const err = new Error('No se pudo guardar la imagen') as AppError;
    err.statusCode = 500;
    throw err;
  }

  try {
    await updateAsset(assetId, { imageKey: objectKey });
  } catch (error) {
    await deleteInventoryPhotoObject(objectKey);
    throw error;
  }

  if (previousKey) {
    try {
      await deleteInventoryPhotoObject(previousKey);
    } catch (error) {
      console.warn('[asset-photo] No se pudo eliminar imagen anterior:', error);
    }
  }

  return { photoUrl: buildClientAssetPhotoUrl(assetId) };
}

export async function serveAssetPhotoService(
  assetId: number,
): Promise<{ stream: Readable; contentType: string }> {
  const row = await findAssetById(assetId);
  if (!row) throw notFound();
  if (!row.imageKey?.trim()) {
    throw notFound('Este activo no tiene foto');
  }

  try {
    return await getInventoryPhotoObject(row.imageKey);
  } catch (error) {
    console.error('[asset-photo] Error al leer de MinIO:', error);
    const err = new Error('No se pudo cargar la imagen') as AppError;
    err.statusCode = 500;
    throw err;
  }
}

export async function deleteAssetPhotoService(assetId: number): Promise<void> {
  const row = await findAssetById(assetId);
  if (!row) throw notFound();

  if (row.imageKey) {
    try {
      await deleteInventoryPhotoObject(row.imageKey);
    } catch (error) {
      console.error('[asset-photo] Error al eliminar de MinIO:', error);
      const err = new Error('No se pudo eliminar la imagen almacenada') as AppError;
      err.statusCode = 500;
      throw err;
    }
  }

  await updateAsset(assetId, { imageKey: null });
}
