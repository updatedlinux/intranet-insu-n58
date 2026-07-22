import {
  createFolder,
  findMirrorFolderByAreaId,
  findRootFolder,
  folderNameExistsInParent,
  reconcileStaleAreaMirrorFolders,
  updateFolderMirror,
} from '../repositories/document.repository';
import { findAreaById, listAreasOrderedByDepth } from '../repositories/area.repository';

function folderDescription(areaName: string): string {
  return `Repositorio documental de ${areaName}`;
}

async function resolveParentFolderId(parentAreaId: number | null): Promise<number> {
  const root = await findRootFolder();
  if (!root) {
    throw new Error('No existe la carpeta raíz del repositorio documental');
  }
  if (parentAreaId == null) {
    return root.id;
  }

  const parentArea = await findAreaById(parentAreaId);
  if (!parentArea) {
    return root.id;
  }

  await ensureAreaMirrorFolder(parentAreaId);
  const parentFolder = await findMirrorFolderByAreaId(parentAreaId);
  if (!parentFolder?.isActive) {
    return root.id;
  }
  return parentFolder.id;
}

export async function ensureAreaMirrorFolder(areaId: number): Promise<number> {
  const existing = await findMirrorFolderByAreaId(areaId);
  const area = await findAreaById(areaId);
  if (!area) {
    throw new Error('Área no encontrada');
  }

  const parentFolderId = await resolveParentFolderId(area.parentAreaId);
  const name = area.name.trim();
  const description = folderDescription(name);
  const shouldBeActive = area.isActive;

  if (existing) {
    const needsUpdate =
      existing.name !== name ||
      existing.description !== description ||
      existing.parentFolderId !== parentFolderId ||
      existing.isActive !== shouldBeActive;

    if (needsUpdate) {
      await updateFolderMirror(existing.id, {
        name,
        description,
        parentFolderId,
        isActive: shouldBeActive,
      });
    }
    return existing.id;
  }

  if (await folderNameExistsInParent(name, parentFolderId)) {
    const id = await createFolder({
      name: `${name} (${areaId})`,
      description,
      parentFolderId,
      areaId: area.id,
      isAreaMirror: true,
      mirrorAreaId: area.id,
    });
    return id;
  }

  return createFolder({
    name,
    description,
    parentFolderId,
    areaId: area.id,
    isAreaMirror: true,
    mirrorAreaId: area.id,
  });
}

export async function syncAreaMirrorFolder(
  areaId: number,
  previousParentAreaId: number | null,
): Promise<void> {
  const area = await findAreaById(areaId);
  if (!area) return;

  if (previousParentAreaId !== area.parentAreaId) {
    if (area.parentAreaId != null && (await findAreaById(area.parentAreaId))) {
      await ensureAreaMirrorFolder(area.parentAreaId);
    }
  }

  await ensureAreaMirrorFolder(areaId);
}

/** Repara carpetas huérfanas y sincroniza espejos para todas las áreas (idempotente). */
export async function syncAllAreaMirrorFolders(): Promise<number> {
  const reconciled = await reconcileStaleAreaMirrorFolders();
  if (reconciled > 0) {
    console.log(`[area-folder-sync] ${reconciled} carpeta(s) marcada(s) como área eliminada`);
  }

  const areas = await listAreasOrderedByDepth();
  let synced = 0;

  for (const area of areas) {
    try {
      await ensureAreaMirrorFolder(area.id);
      synced += 1;
    } catch (error) {
      console.error(
        `[area-folder-sync] No se pudo sincronizar área ${area.id} (${area.name}):`,
        error,
      );
    }
  }

  return synced;
}
