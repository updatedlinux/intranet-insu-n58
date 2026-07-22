import type { AppError } from '../middlewares/error.middleware';
import { clearAreaAccessCache } from '../policies/document-access.policy';
import {
  createAreaAccess,
  deleteAreaAccess,
  findAreaAccessById,
  listAreaAccess,
  updateAreaAccess,
  type AreaAccessRow,
  type AreaAccessWriteInput,
} from '../repositories/area-access.repository';
import { findAreaById } from '../repositories/area.repository';

export interface PublicAreaAccess {
  id: number;
  sourceAreaId: number;
  targetAreaId: number;
  sourceAreaName: string;
  targetAreaName: string;
  canRead: boolean;
  canUpload: boolean;
  canApprove: boolean;
  canAnnounce: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

function notFound(message = 'Registro no encontrado'): AppError {
  const error = new Error(message) as AppError;
  error.statusCode = 404;
  return error;
}

function badRequest(message: string): AppError {
  const error = new Error(message) as AppError;
  error.statusCode = 400;
  return error;
}

function toPublic(row: AreaAccessRow): PublicAreaAccess {
  return {
    id: row.id,
    sourceAreaId: row.sourceAreaId,
    targetAreaId: row.targetAreaId,
    sourceAreaName: row.sourceAreaName,
    targetAreaName: row.targetAreaName,
    canRead: row.canRead,
    canUpload: row.canUpload,
    canApprove: row.canApprove,
    canAnnounce: row.canAnnounce,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function assertAreas(sourceAreaId: number, targetAreaId: number): Promise<void> {
  if (sourceAreaId === targetAreaId) {
    throw badRequest('El área origen y destino deben ser distintas');
  }
  const [source, target] = await Promise.all([
    findAreaById(sourceAreaId),
    findAreaById(targetAreaId),
  ]);
  if (!source) throw badRequest('Área origen no existe');
  if (!target) throw badRequest('Área destino no existe');
}

export async function listAreaAccessService(filters?: {
  sourceAreaId?: number;
  targetAreaId?: number;
  isActive?: boolean;
}): Promise<{ items: PublicAreaAccess[] }> {
  const rows = await listAreaAccess(filters);
  return { items: rows.map(toPublic) };
}

export async function getAreaAccessService(id: number): Promise<PublicAreaAccess> {
  const row = await findAreaAccessById(id);
  if (!row) throw notFound();
  return toPublic(row);
}

export async function createAreaAccessService(
  input: AreaAccessWriteInput,
): Promise<PublicAreaAccess> {
  await assertAreas(input.sourceAreaId, input.targetAreaId);
  if (!input.canRead && !input.canUpload && !input.canApprove && !input.canAnnounce) {
    throw badRequest('Debe habilitar al menos un permiso');
  }
  const id = await createAreaAccess(input);
  clearAreaAccessCache();
  const row = await findAreaAccessById(id);
  if (!row) throw notFound();
  return toPublic(row);
}

export async function updateAreaAccessService(
  id: number,
  input: AreaAccessWriteInput,
): Promise<PublicAreaAccess> {
  const existing = await findAreaAccessById(id);
  if (!existing) throw notFound();
  await assertAreas(input.sourceAreaId, input.targetAreaId);
  if (!input.canRead && !input.canUpload && !input.canApprove && !input.canAnnounce) {
    throw badRequest('Debe habilitar al menos un permiso');
  }
  await updateAreaAccess(id, input);
  clearAreaAccessCache();
  const row = await findAreaAccessById(id);
  if (!row) throw notFound();
  return toPublic(row);
}

export async function deleteAreaAccessService(id: number): Promise<void> {
  const existing = await findAreaAccessById(id);
  if (!existing) throw notFound();
  await deleteAreaAccess(id);
  clearAreaAccessCache();
}
