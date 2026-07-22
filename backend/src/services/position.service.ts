import sql from 'mssql';
import type { AppError } from '../middlewares/error.middleware';
import { getPool } from '../config/database';
import { findAreaById } from '../repositories/area.repository';
import { updateUsersAreaByPosition } from '../repositories/collaborator.repository';
import {
  countActiveCollaboratorsByPosition,
  countCollaboratorsByPosition,
  createPosition,
  deletePosition,
  findPositionById,
  listPositions,
  positionNameExistsInArea,
  setPositionActive,
  updatePosition,
  type PositionListFilters,
  type PositionRow,
} from '../repositories/position.repository';

export interface PublicPosition {
  id: number;
  name: string;
  areaId: number;
  areaName: string;
  isLeader: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  collaboratorCount: number;
  activeCollaboratorCount: number;
}

function notFound(message = 'Cargo no encontrado'): AppError {
  const error = new Error(message) as AppError;
  error.statusCode = 404;
  return error;
}

function conflict(message: string): AppError {
  const error = new Error(message) as AppError;
  error.statusCode = 409;
  return error;
}

function badRequest(message: string): AppError {
  const error = new Error(message) as AppError;
  error.statusCode = 400;
  return error;
}

async function enrichPosition(row: PositionRow): Promise<PublicPosition> {
  const [collaboratorCount, activeCollaboratorCount] = await Promise.all([
    countCollaboratorsByPosition(row.id),
    countActiveCollaboratorsByPosition(row.id),
  ]);

  return {
    id: row.id,
    name: row.name,
    areaId: row.areaId,
    areaName: row.areaName,
    isLeader: row.isLeader,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    collaboratorCount,
    activeCollaboratorCount,
  };
}

async function assertAreaExists(areaId: number, requireActive: boolean): Promise<void> {
  const area = await findAreaById(areaId);
  if (!area) {
    throw badRequest('El área indicada no existe');
  }
  if (requireActive && !area.isActive) {
    throw badRequest('Debe seleccionar un área activa');
  }
}

async function assertCanDeactivate(positionId: number): Promise<void> {
  const activeCount = await countActiveCollaboratorsByPosition(positionId);
  if (activeCount > 0) {
    throw conflict(
      `No se puede inactivar el cargo porque tiene ${activeCount} colaborador${activeCount === 1 ? '' : 'es'} activo${activeCount === 1 ? '' : 's'} asignado${activeCount === 1 ? '' : 's'}`,
    );
  }
}

export async function listPositionsService(
  filters: PositionListFilters,
): Promise<{ items: PublicPosition[] }> {
  const rows = await listPositions(filters);
  const items = await Promise.all(rows.map((row) => enrichPosition(row)));
  return { items };
}

export async function getPositionService(id: number): Promise<PublicPosition> {
  const row = await findPositionById(id);
  if (!row) throw notFound();
  return enrichPosition(row);
}

export async function createPositionService(data: {
  name: string;
  areaId: number;
  isLeader: boolean;
  isActive: boolean;
}): Promise<PublicPosition> {
  await assertAreaExists(data.areaId, data.isActive);

  if (await positionNameExistsInArea(data.name, data.areaId)) {
    throw conflict('Ya existe un cargo con ese nombre en el área seleccionada');
  }

  const id = await createPosition(data);
  return getPositionService(id);
}

export async function updatePositionService(
  id: number,
  data: {
    name: string;
    areaId: number;
    isLeader: boolean;
    isActive: boolean;
  },
): Promise<PublicPosition> {
  const existing = await findPositionById(id);
  if (!existing) throw notFound();

  await assertAreaExists(data.areaId, data.isActive);

  if (await positionNameExistsInArea(data.name, data.areaId, id)) {
    throw conflict('Ya existe otro cargo con ese nombre en el área seleccionada');
  }

  const areaChanged = data.areaId !== existing.areaId;
  const collaboratorCount = await countCollaboratorsByPosition(id);

  if (!data.isActive && existing.isActive) {
    await assertCanDeactivate(id);
  }

  if (collaboratorCount > 0 && areaChanged) {
    const pool = getPool();
    const transaction = new sql.Transaction(pool);
    await transaction.begin();
    try {
      await updatePosition(id, data, transaction);
      await updateUsersAreaByPosition(id, data.areaId, transaction);
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  } else {
    await updatePosition(id, data);
  }

  return getPositionService(id);
}

export async function togglePositionService(
  id: number,
  isActive: boolean,
): Promise<PublicPosition> {
  const existing = await findPositionById(id);
  if (!existing) throw notFound();

  if (!isActive && existing.isActive) {
    await assertCanDeactivate(id);
  }

  if (isActive && !existing.isActive) {
    await assertAreaExists(existing.areaId, true);
  }

  await setPositionActive(id, isActive);
  return getPositionService(id);
}

export async function deletePositionService(id: number): Promise<void> {
  const existing = await findPositionById(id);
  if (!existing) throw notFound();
  const collaboratorCount = await countCollaboratorsByPosition(id);
  if (collaboratorCount > 0) {
    throw conflict(
      `No se puede eliminar: el cargo tiene ${collaboratorCount} colaborador${collaboratorCount === 1 ? '' : 'es'} asignado${collaboratorCount === 1 ? '' : 's'}`,
    );
  }
  await deletePosition(id);
}
