import type { AppError } from '../middlewares/error.middleware';
import { isAdminRole } from '../constants/roles';
import {
  findUserAvatarUrl,
  updateUserAvatarUrl,
  userExists,
} from '../repositories/avatar.repository';
import type { AuthenticatedUser } from '../types/auth';
import type { PublicCollaborator } from './collaborator.service';
import { getCollaboratorService } from './collaborator.service';
import { buildClientAvatarUrl } from '../utils/avatar-url';
import type { Readable } from 'node:stream';
import {
  AVATAR_MAX_BYTES,
  buildAvatarObjectKey,
  deleteAvatarByStoredUrl,
  formatAvatarMaxSizeLabel,
  getAvatarObject,
  resolveAvatarExtension,
  uploadAvatarObject,
  validateAvatarMimeType,
} from './avatar-storage.service';

export interface AvatarUploadFile {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
}

function forbidden(message: string): AppError {
  const error = new Error(message) as AppError;
  error.statusCode = 403;
  return error;
}

function notFound(message = 'Usuario no encontrado'): AppError {
  const error = new Error(message) as AppError;
  error.statusCode = 404;
  return error;
}

function badRequest(message: string): AppError {
  const error = new Error(message) as AppError;
  error.statusCode = 400;
  return error;
}

export function assertCanManageAvatar(actor: AuthenticatedUser, targetUserId: number): void {
  if (isAdminRole(actor.roleName)) {
    return;
  }
  if (actor.id === targetUserId) {
    return;
  }
  throw forbidden('No tiene permisos para modificar el avatar de este usuario');
}

function validateUploadFile(file: AvatarUploadFile): void {
  if (!file.buffer?.length) {
    throw badRequest('No se recibió ningún archivo de imagen');
  }

  if (file.size > AVATAR_MAX_BYTES) {
    throw badRequest(`La imagen no puede superar ${formatAvatarMaxSizeLabel()}`);
  }

  if (!validateAvatarMimeType(file.mimetype)) {
    throw badRequest('Formato no permitido. Use JPG, JPEG, PNG o WebP');
  }
}

export async function uploadUserAvatarService(
  actor: AuthenticatedUser,
  targetUserId: number,
  file: AvatarUploadFile,
): Promise<{ avatarUrl: string; collaborator: PublicCollaborator }> {
  assertCanManageAvatar(actor, targetUserId);
  validateUploadFile(file);

  if (!(await userExists(targetUserId))) {
    throw notFound();
  }

  const previousUrl = await findUserAvatarUrl(targetUserId);
  const extension = resolveAvatarExtension(file.mimetype, file.originalname);
  const objectKey = buildAvatarObjectKey(targetUserId, extension);

  let newUrl: string;
  try {
    newUrl = await uploadAvatarObject(objectKey, file.buffer, file.mimetype);
  } catch (error) {
    console.error('[avatar] Error al subir a MinIO:', error);
    const err = new Error('No se pudo guardar la imagen') as AppError;
    err.statusCode = 500;
    throw err;
  }

  try {
    await updateUserAvatarUrl(targetUserId, newUrl);
  } catch (error) {
    await deleteAvatarByStoredUrl(newUrl);
    throw error;
  }

  if (previousUrl) {
    try {
      await deleteAvatarByStoredUrl(previousUrl);
    } catch (error) {
      console.warn('[avatar] No se pudo eliminar avatar anterior:', error);
    }
  }

  const collaborator = await getCollaboratorService(targetUserId);
  return { avatarUrl: buildClientAvatarUrl(targetUserId), collaborator };
}

export async function serveUserAvatarService(
  _actor: AuthenticatedUser,
  targetUserId: number,
): Promise<{ stream: Readable; contentType: string }> {
  if (!(await userExists(targetUserId))) {
    throw notFound();
  }

  const storedUrl = await findUserAvatarUrl(targetUserId);
  if (!storedUrl?.trim()) {
    throw notFound('Este usuario no tiene avatar');
  }

  try {
    return await getAvatarObject(storedUrl);
  } catch (error) {
    console.error('[avatar] Error al leer de MinIO:', error);
    const err = new Error('No se pudo cargar la imagen') as AppError;
    err.statusCode = 500;
    throw err;
  }
}

export async function deleteUserAvatarService(
  actor: AuthenticatedUser,
  targetUserId: number,
): Promise<{ collaborator: PublicCollaborator }> {
  assertCanManageAvatar(actor, targetUserId);

  if (!(await userExists(targetUserId))) {
    throw notFound();
  }

  const previousUrl = await findUserAvatarUrl(targetUserId);
  if (previousUrl) {
    try {
      await deleteAvatarByStoredUrl(previousUrl);
    } catch (error) {
      console.error('[avatar] Error al eliminar de MinIO:', error);
      const err = new Error('No se pudo eliminar la imagen almacenada') as AppError;
      err.statusCode = 500;
      throw err;
    }
  }

  await updateUserAvatarUrl(targetUserId, null);

  const collaborator = await getCollaboratorService(targetUserId);
  return { collaborator };
}
