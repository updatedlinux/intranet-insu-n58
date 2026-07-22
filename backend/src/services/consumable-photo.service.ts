import type { Readable } from 'node:stream';
import type { AppError } from '../middlewares/error.middleware';
import { findConsumableById, updateConsumable } from '../repositories/consumable.repository';
import { buildClientConsumablePhotoUrl } from '../utils/consumable-photo-url';
import type { AssetPhotoUploadFile } from './asset-photo.service';
import {
  buildConsumablePhotoObjectKey,
  deleteInventoryPhotoObject,
  formatInventoryPhotoMaxSizeLabel,
  getInventoryPhotoObject,
  resolveAssetPhotoExtension,
  uploadAssetPhotoObject,
  validateAssetPhotoMimeType,
  INVENTORY_PHOTO_MAX_BYTES,
} from './asset-photo-storage.service';

function notFound(msg = 'Consumible no encontrado'): AppError {
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

export async function uploadConsumablePhotoService(
  consumableId: number,
  file: AssetPhotoUploadFile,
): Promise<{ photoUrl: string }> {
  validateUploadFile(file);

  const row = await findConsumableById(consumableId);
  if (!row) throw notFound();

  const previousKey = row.imageKey;
  const extension = resolveAssetPhotoExtension(file.mimetype, file.originalname);
  const objectKey = buildConsumablePhotoObjectKey(consumableId, extension);

  try {
    await uploadAssetPhotoObject(objectKey, file.buffer, file.mimetype);
  } catch (error) {
    console.error('[consumable-photo] Error al subir a MinIO:', error);
    const err = new Error('No se pudo guardar la imagen') as AppError;
    err.statusCode = 500;
    throw err;
  }

  try {
    await updateConsumable(consumableId, { imageKey: objectKey });
  } catch (error) {
    await deleteInventoryPhotoObject(objectKey);
    throw error;
  }

  if (previousKey) {
    try {
      await deleteInventoryPhotoObject(previousKey);
    } catch (error) {
      console.warn('[consumable-photo] No se pudo eliminar imagen anterior:', error);
    }
  }

  return { photoUrl: buildClientConsumablePhotoUrl(consumableId) };
}

export async function serveConsumablePhotoService(
  consumableId: number,
): Promise<{ stream: Readable; contentType: string }> {
  const row = await findConsumableById(consumableId);
  if (!row) throw notFound();
  if (!row.imageKey?.trim()) {
    throw notFound('Este consumible no tiene foto');
  }

  try {
    return await getInventoryPhotoObject(row.imageKey);
  } catch (error) {
    console.error('[consumable-photo] Error al leer de MinIO:', error);
    const err = new Error('No se pudo cargar la imagen') as AppError;
    err.statusCode = 500;
    throw err;
  }
}

export async function deleteConsumablePhotoService(consumableId: number): Promise<void> {
  const row = await findConsumableById(consumableId);
  if (!row) throw notFound();

  if (row.imageKey) {
    try {
      await deleteInventoryPhotoObject(row.imageKey);
    } catch (error) {
      console.error('[consumable-photo] Error al eliminar de MinIO:', error);
      const err = new Error('No se pudo eliminar la imagen almacenada') as AppError;
      err.statusCode = 500;
      throw err;
    }
  }

  await updateConsumable(consumableId, { imageKey: null });
}
