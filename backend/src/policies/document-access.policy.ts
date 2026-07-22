import { isAdminRole } from '../constants/roles';
import { DOCUMENT_STATUS, type DocumentStatus } from '../constants/document-status';
import type { FolderRow, DocumentRow } from '../repositories/document.repository';
import { getAreaAccessForSource, type AreaAccessRow } from '../repositories/area-access.repository';
import type { AuthenticatedUser } from '../types/auth';

export interface DocumentCapabilities {
  isAdmin: boolean;
  isAreaLeader: boolean;
  canCreateFolder: boolean;
  canUpload: boolean;
  canApprove: boolean;
  readableAreaIds: number[];
}

let accessCache = new Map<number, { at: number; rows: AreaAccessRow[] }>();
const CACHE_TTL_MS = 60_000;

export function isSystemAdmin(user: AuthenticatedUser): boolean {
  return isAdminRole(user.roleName);
}

export function isAreaLeader(user: AuthenticatedUser): boolean {
  return user.ledAreaIds.length > 0 || Boolean(user.position.isLeader);
}

export function isLeaderOfArea(user: AuthenticatedUser, areaId: number): boolean {
  return (
    user.ledAreaIds.includes(areaId) || (Boolean(user.position.isLeader) && user.area.id === areaId)
  );
}

export function isCollaboratorOnly(user: AuthenticatedUser): boolean {
  return !isSystemAdmin(user) && !isAreaLeader(user);
}

export async function loadAreaAccess(sourceAreaId: number): Promise<AreaAccessRow[]> {
  const cached = accessCache.get(sourceAreaId);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return cached.rows;
  }
  const rows = await getAreaAccessForSource(sourceAreaId);
  accessCache.set(sourceAreaId, { at: Date.now(), rows });
  return rows;
}

export function clearAreaAccessCache(): void {
  accessCache = new Map();
}

export async function getReadableAreaIds(user: AuthenticatedUser): Promise<number[]> {
  if (isSystemAdmin(user)) return [];
  const ids = new Set<number>([user.area.id]);
  for (const id of user.ledAreaIds) ids.add(id);
  const grants = await loadAreaAccess(user.area.id);
  for (const g of grants) {
    if (g.canRead && g.isActive) ids.add(g.targetAreaId);
  }
  return [...ids];
}

export async function canReadArea(
  user: AuthenticatedUser,
  areaId: number | null,
): Promise<boolean> {
  if (areaId == null) return isSystemAdmin(user);
  if (isSystemAdmin(user)) return true;
  if (user.area.id === areaId) return true;
  if (isLeaderOfArea(user, areaId)) return true;
  const grants = await loadAreaAccess(user.area.id);
  return grants.some((g) => g.isActive && g.canRead && g.targetAreaId === areaId);
}

export async function canUploadToArea(
  user: AuthenticatedUser,
  areaId: number | null,
): Promise<boolean> {
  if (areaId == null) return isSystemAdmin(user);
  if (isSystemAdmin(user)) return true;
  if (user.area.id === areaId) return true;
  const grants = await loadAreaAccess(user.area.id);
  return grants.some((g) => g.isActive && g.canUpload && g.targetAreaId === areaId);
}

export async function canApproveInArea(
  user: AuthenticatedUser,
  areaId: number | null,
): Promise<boolean> {
  if (areaId == null) return isSystemAdmin(user);
  if (isSystemAdmin(user)) return true;
  if (isLeaderOfArea(user, areaId)) return true;
  const grants = await loadAreaAccess(user.area.id);
  return grants.some((g) => g.isActive && g.canApprove && g.targetAreaId === areaId);
}

export async function canReadFolder(user: AuthenticatedUser, folder: FolderRow): Promise<boolean> {
  if (!folder.isActive) return false;
  if (folder.areaId == null) return isSystemAdmin(user);
  return canReadArea(user, folder.areaId);
}

export async function canUploadToFolder(
  user: AuthenticatedUser,
  folder: FolderRow,
): Promise<boolean> {
  if (!folder.isActive) return false;
  if (folder.areaId == null) return isSystemAdmin(user);
  return canUploadToArea(user, folder.areaId);
}

export async function canCreateFolderIn(
  user: AuthenticatedUser,
  folder: FolderRow,
): Promise<boolean> {
  if (!folder.isActive) return false;
  if (isSystemAdmin(user)) return true;
  if (!isAreaLeader(user)) return false;
  if (folder.areaId == null) {
    return true;
  }
  return isLeaderOfArea(user, folder.areaId) || (await canApproveInArea(user, folder.areaId));
}

export async function canManageFolder(
  user: AuthenticatedUser,
  folder: FolderRow,
): Promise<boolean> {
  if (isSystemAdmin(user)) return true;
  if (!isAreaLeader(user) || folder.areaId == null) return false;
  return isLeaderOfArea(user, folder.areaId) || (await canApproveInArea(user, folder.areaId));
}

export function resolveFolderAreaId(
  parent: FolderRow,
  user: AuthenticatedUser,
  explicitAreaId: number | null,
): number | null {
  if (parent.areaId != null) return parent.areaId;
  if (explicitAreaId != null) return explicitAreaId;
  if (isSystemAdmin(user) && explicitAreaId == null) return null;
  return user.area.id;
}

export async function canViewDocument(
  user: AuthenticatedUser,
  doc: Pick<DocumentRow, 'createdBy' | 'status' | 'areaId' | 'isActive'>,
): Promise<boolean> {
  if (!doc.isActive) return false;
  if (isSystemAdmin(user)) return true;

  const areaId = doc.areaId;
  if (areaId == null) return false;

  const canAccessArea =
    user.area.id === areaId ||
    (await canReadArea(user, areaId)) ||
    (await canApproveInArea(user, areaId));

  if (!canAccessArea) return false;

  if (await canApproveInArea(user, areaId)) return true;
  if (isLeaderOfArea(user, areaId)) return true;

  if (doc.createdBy === user.id) {
    return doc.status === DOCUMENT_STATUS.PENDING || doc.status === DOCUMENT_STATUS.REJECTED;
  }

  return doc.status === DOCUMENT_STATUS.APPROVED;
}

export async function canDownloadDocument(
  user: AuthenticatedUser,
  doc: Pick<DocumentRow, 'createdBy' | 'status' | 'areaId' | 'isActive' | 'fileKey'>,
): Promise<boolean> {
  if (!doc.fileKey) return false;
  return canViewDocument(user, doc);
}

export async function buildCapabilities(
  user: AuthenticatedUser,
  folder: FolderRow,
): Promise<DocumentCapabilities> {
  const readableAreaIds = await getReadableAreaIds(user);
  const canCreateFolder = await canCreateFolderIn(user, folder);
  const canUpload = await canUploadToFolder(user, folder);
  const canApprove =
    isSystemAdmin(user) || (folder.areaId != null && (await canApproveInArea(user, folder.areaId)));

  return {
    isAdmin: isSystemAdmin(user),
    isAreaLeader: isAreaLeader(user),
    canCreateFolder,
    canUpload,
    canApprove,
    readableAreaIds,
  };
}

export function initialDocumentStatus(user: AuthenticatedUser): DocumentStatus {
  if (isCollaboratorOnly(user)) return DOCUMENT_STATUS.PENDING;
  return DOCUMENT_STATUS.APPROVED;
}
