import type { AppError } from '../middlewares/error.middleware';
import {
  areaNameExists,
  countActiveCollaboratorsByArea,
  countChildAreas,
  countCollaboratorsByArea,
  countCorporateEventAreasByArea,
  countDocumentsByArea,
  countFoldersByArea,
  countLearningCourseAccessByArea,
  countTasksByArea,
  createArea,
  deleteArea,
  findAreaById,
  findAreaParentId,
  listAreas,
  setAreaActive,
  updateArea,
  type AreaListFilters,
  type AreaRow,
} from '../repositories/area.repository';
import {
  findActiveUserIds,
  listAreaLeaders,
  listAreaLeadersByAreaIds,
  replaceAreaLeaders,
  type AreaLeaderRow,
} from '../repositories/area-leader.repository';
import { ensureBoardForArea, findBoardByAreaId } from '../repositories/board.repository';
import {
  clearDocumentAreaReferences,
  listDocumentIdsByArea,
  orphanFoldersByArea,
} from '../repositories/document.repository';
import { appendDocumentTag } from '../repositories/document-tag.repository';
import { ensureSystemTag } from '../repositories/tag.repository';
import {
  deleteAllTasksByBoardId,
  transferTasksBetweenBoards,
} from '../repositories/task.repository';
import { ensureAreaMirrorFolder, syncAreaMirrorFolder } from './area-folder-sync.service';

export interface PublicAreaLeader {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  areaName: string;
  positionName: string;
}

export interface PublicArea {
  id: number;
  name: string;
  description: string | null;
  parentAreaId: number | null;
  parentAreaName: string | null;
  isActive: boolean;
  isItSupportArea: boolean;
  createdAt: string;
  updatedAt: string;
  collaboratorCount: number;
  activeCollaboratorCount: number;
  leaders: PublicAreaLeader[];
}

export interface AreaDeletePreview {
  childAreas: number;
  collaborators: number;
  documents: number;
  folders: number;
  tasks: number;
  learningAccess: number;
  corporateEvents: number;
  requiresTaskDecision: boolean;
}

export type AreaDeleteTaskAction = 'transfer' | 'delete';

export interface AreaDeleteOptions {
  taskAction?: AreaDeleteTaskAction;
  transferToAreaId?: number;
}

const AREA_ORPHAN_TAG_NAME = 'Área eliminada';

function notFound(message = 'Área no encontrada'): AppError {
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

async function enrichArea(row: AreaRow, leaders: AreaLeaderRow[]): Promise<PublicArea> {
  const [collaboratorCount, activeCollaboratorCount] = await Promise.all([
    countCollaboratorsByArea(row.id),
    countActiveCollaboratorsByArea(row.id),
  ]);

  return {
    id: row.id,
    name: row.name,
    description: row.description,
    parentAreaId: row.parentAreaId,
    parentAreaName: row.parentAreaName,
    isActive: row.isActive,
    isItSupportArea: row.isItSupportArea,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    collaboratorCount,
    activeCollaboratorCount,
    leaders: leaders.map((l) => ({
      id: l.id,
      firstName: l.firstName,
      lastName: l.lastName,
      email: l.email,
      areaName: l.areaName,
      positionName: l.positionName,
    })),
  };
}

async function assertValidLeaders(leaderIds: number[]): Promise<void> {
  if (leaderIds.length === 0) return;
  const activeIds = await findActiveUserIds(leaderIds);
  if (activeIds.length !== leaderIds.length) {
    throw badRequest('Uno o más líderes no existen o están inactivos');
  }
}

async function assertValidParent(
  areaId: number | null,
  parentAreaId: number | null,
): Promise<void> {
  if (parentAreaId == null) {
    return;
  }

  if (areaId != null && parentAreaId === areaId) {
    throw badRequest('Un área no puede ser padre de sí misma');
  }

  const parent = await findAreaById(parentAreaId);
  if (!parent) {
    throw badRequest('El área padre indicada no existe');
  }

  if (areaId == null) {
    return;
  }

  let current: number | null = parentAreaId;
  const visited = new Set<number>();

  while (current != null) {
    if (current === areaId) {
      throw badRequest('La jerarquía de áreas no puede ser circular');
    }
    if (visited.has(current)) {
      break;
    }
    visited.add(current);
    current = await findAreaParentId(current);
  }
}

async function assertCanDeactivate(areaId: number): Promise<void> {
  const activeCount = await countActiveCollaboratorsByArea(areaId);
  if (activeCount > 0) {
    throw conflict(
      `No se puede inactivar el área porque tiene ${activeCount} colaborador${activeCount === 1 ? '' : 'es'} activo${activeCount === 1 ? '' : 's'} asignado${activeCount === 1 ? '' : 's'}`,
    );
  }
}

async function orphanAreaDocumentAssets(areaId: number, areaName: string): Promise<void> {
  const tagId = await ensureSystemTag(
    AREA_ORPHAN_TAG_NAME,
    'El área organizacional asociada ya no existe; el archivo se conserva por seguridad.',
  );
  const documentIds = await listDocumentIdsByArea(areaId);
  await orphanFoldersByArea(areaId, areaName);
  for (const documentId of documentIds) {
    await appendDocumentTag(documentId, tagId);
  }
  await clearDocumentAreaReferences(areaId);
}

async function resolveAreaDeleteCounts(areaId: number) {
  return Promise.all([
    countChildAreas(areaId),
    countCollaboratorsByArea(areaId),
    countDocumentsByArea(areaId),
    countFoldersByArea(areaId),
    countTasksByArea(areaId),
    countLearningCourseAccessByArea(areaId),
    countCorporateEventAreasByArea(areaId),
  ]);
}

async function handleAreaTasksBeforeDelete(
  areaId: number,
  taskCount: number,
  options: AreaDeleteOptions,
): Promise<void> {
  if (taskCount === 0) return;

  const action = options.taskAction;
  if (action !== 'transfer' && action !== 'delete') {
    throw badRequest(
      'Debe indicar si desea transferir las tareas a otra área o eliminarlas definitivamente',
    );
  }

  const sourceBoard = await findBoardByAreaId(areaId);
  if (!sourceBoard) return;

  if (action === 'delete') {
    await deleteAllTasksByBoardId(sourceBoard.id);
    return;
  }

  const transferToAreaId = options.transferToAreaId;
  if (transferToAreaId == null) {
    throw badRequest('Debe seleccionar el área destino para transferir las tareas');
  }
  if (transferToAreaId === areaId) {
    throw badRequest('El área destino debe ser diferente al área que se elimina');
  }

  const targetArea = await findAreaById(transferToAreaId);
  if (!targetArea?.isActive) {
    throw badRequest('El área destino no existe o está inactiva');
  }

  const targetBoard = await findBoardByAreaId(transferToAreaId);
  if (!targetBoard) {
    await ensureBoardForArea(transferToAreaId, targetArea.name);
  }
  const resolvedTargetBoard = await findBoardByAreaId(transferToAreaId);
  if (!resolvedTargetBoard) {
    throw badRequest('No se pudo preparar el tablero del área destino');
  }

  await transferTasksBetweenBoards(sourceBoard.id, resolvedTargetBoard.id);
}

export async function listAreasService(filters: AreaListFilters): Promise<{ items: PublicArea[] }> {
  const rows = await listAreas(filters);
  const leaderMap = await listAreaLeadersByAreaIds(rows.map((r) => r.id));
  const items = await Promise.all(rows.map((row) => enrichArea(row, leaderMap.get(row.id) ?? [])));
  return { items };
}

export async function getAreaService(id: number): Promise<PublicArea> {
  const row = await findAreaById(id);
  if (!row) throw notFound();
  const leaders = await listAreaLeaders(id);
  return enrichArea(row, leaders);
}

export async function getAreaDeletePreviewService(id: number): Promise<AreaDeletePreview> {
  const existing = await findAreaById(id);
  if (!existing) throw notFound();

  const [childAreas, collaborators, documents, folders, tasks, learningAccess, corporateEvents] =
    await resolveAreaDeleteCounts(id);

  return {
    childAreas,
    collaborators,
    documents,
    folders,
    tasks,
    learningAccess,
    corporateEvents,
    requiresTaskDecision: tasks > 0,
  };
}

export async function createAreaService(data: {
  name: string;
  description: string | null;
  parentAreaId: number | null;
  isActive: boolean;
  isItSupportArea: boolean;
  leaderIds: number[];
}): Promise<PublicArea> {
  if (await areaNameExists(data.name)) {
    throw conflict('Ya existe un área con ese nombre');
  }

  await assertValidParent(null, data.parentAreaId);
  await assertValidLeaders(data.leaderIds);

  if (data.parentAreaId != null) {
    const parent = await findAreaById(data.parentAreaId);
    if (!parent?.isActive && data.isActive) {
      throw badRequest('No puede asignar un área padre inactiva a un área activa');
    }
  }

  const { leaderIds, ...areaInput } = data;
  const id = await createArea(areaInput);
  if (leaderIds.length > 0) {
    await replaceAreaLeaders(id, leaderIds);
  }
  const created = await findAreaById(id);
  if (created) {
    await ensureBoardForArea(id, created.name);
    await ensureAreaMirrorFolder(id);
  }
  return getAreaService(id);
}

export async function updateAreaService(
  id: number,
  data: {
    name: string;
    description: string | null;
    parentAreaId: number | null;
    isActive: boolean;
    isItSupportArea: boolean;
    leaderIds: number[];
  },
): Promise<PublicArea> {
  const existing = await findAreaById(id);
  if (!existing) throw notFound();

  if (await areaNameExists(data.name, id)) {
    throw conflict('Ya existe otra área con ese nombre');
  }

  await assertValidParent(id, data.parentAreaId);
  await assertValidLeaders(data.leaderIds);

  if (!data.isActive && existing.isActive) {
    await assertCanDeactivate(id);
  }

  if (data.parentAreaId != null) {
    const parent = await findAreaById(data.parentAreaId);
    if (!parent?.isActive && data.isActive) {
      throw badRequest('No puede asignar un área padre inactiva a un área activa');
    }
  }

  const previousParentAreaId = existing.parentAreaId;
  const { leaderIds, ...areaInput } = data;
  await updateArea(id, areaInput);
  await replaceAreaLeaders(id, leaderIds);
  await ensureBoardForArea(id, data.name);
  await syncAreaMirrorFolder(id, previousParentAreaId);
  return getAreaService(id);
}

export async function toggleAreaService(id: number, isActive: boolean): Promise<PublicArea> {
  const existing = await findAreaById(id);
  if (!existing) throw notFound();

  if (!isActive && existing.isActive) {
    await assertCanDeactivate(id);
  }

  await setAreaActive(id, isActive);
  if (isActive) {
    await ensureAreaMirrorFolder(id);
  }
  return getAreaService(id);
}

function formatAreaDeleteBlockers(parts: string[]): string {
  return `No se puede eliminar el área: ${parts.join(', ')}`;
}

export async function deleteAreaService(
  id: number,
  options: AreaDeleteOptions = {},
): Promise<void> {
  const existing = await findAreaById(id);
  if (!existing) throw notFound();

  const [childAreas, collaborators, documents, folders, tasks, learningAccess, corporateEvents] =
    await resolveAreaDeleteCounts(id);

  const blockers: string[] = [];
  if (childAreas > 0) {
    blockers.push(
      `${childAreas} área${childAreas === 1 ? '' : 's'} hija${childAreas === 1 ? '' : 's'}`,
    );
  }
  if (collaborators > 0) {
    blockers.push(
      `${collaborators} colaborador${collaborators === 1 ? '' : 'es'} asignado${collaborators === 1 ? '' : 's'}`,
    );
  }
  if (learningAccess > 0) {
    blockers.push(`${learningAccess} acceso${learningAccess === 1 ? '' : 's'} a cursos`);
  }
  if (corporateEvents > 0) {
    blockers.push(
      `${corporateEvents} evento${corporateEvents === 1 ? '' : 's'} corporativo${corporateEvents === 1 ? '' : 's'}`,
    );
  }

  if (blockers.length > 0) {
    throw conflict(formatAreaDeleteBlockers(blockers));
  }

  await handleAreaTasksBeforeDelete(id, tasks, options);

  if (documents > 0 || folders > 0) {
    await orphanAreaDocumentAssets(id, existing.name);
  }

  await deleteArea(id);
}
