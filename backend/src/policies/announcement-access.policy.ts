import { isCorporateLeadershipArea } from '../constants/corporate-areas';
import { ANNOUNCEMENT_STATUS } from '../constants/announcement-status';
import type { AnnouncementRow } from '../repositories/announcement.repository';
import {
  isAreaLeader,
  isLeaderOfArea,
  isSystemAdmin,
  loadAreaAccess,
} from './document-access.policy';
import type { AuthenticatedUser } from '../types/auth';

/** Admin de sistema o gerente general (líder en Dirección General). */
export function canPublishCompanyWide(user: AuthenticatedUser): boolean {
  if (isSystemAdmin(user)) return true;
  if (user.ledAreas.some((a) => isCorporateLeadershipArea(a.name))) return true;
  return Boolean(user.position.isLeader) && isCorporateLeadershipArea(user.area.name);
}

export function canManageAnnouncements(user: AuthenticatedUser): boolean {
  return isSystemAdmin(user) || isAreaLeader(user);
}

export function assertCanManageAnnouncements(user: AuthenticatedUser): void {
  if (!canManageAnnouncements(user)) {
    const error = new Error('No tiene permisos para gestionar comunicados') as Error & {
      statusCode: number;
    };
    error.statusCode = 403;
    throw error;
  }
}

export async function getPublishableTargetAreaIds(user: AuthenticatedUser): Promise<number[]> {
  if (isSystemAdmin(user)) return [];
  const ids = new Set<number>([user.area.id]);
  for (const id of user.ledAreaIds) ids.add(id);
  const grants = await loadAreaAccess(user.area.id);
  for (const g of grants) {
    if (g.isActive && g.canAnnounce) ids.add(g.targetAreaId);
  }
  return [...ids];
}

export async function canPublishToArea(
  user: AuthenticatedUser,
  targetAreaId: number | null,
): Promise<boolean> {
  if (!canManageAnnouncements(user)) return false;
  if (targetAreaId == null) return canPublishCompanyWide(user);
  if (isSystemAdmin(user)) return true;
  if (!isAreaLeader(user)) return false;
  if (isLeaderOfArea(user, targetAreaId)) return true;
  const grants = await loadAreaAccess(user.area.id);
  return grants.some((g) => g.isActive && g.canAnnounce && g.targetAreaId === targetAreaId);
}

export async function assertTargetAreaAllowed(
  user: AuthenticatedUser,
  targetAreaId: number | null,
): Promise<void> {
  if (await canPublishToArea(user, targetAreaId)) return;
  if (targetAreaId == null) {
    const error = new Error(
      'Solo administración o gerencia general pueden enviar comunicados a toda la empresa',
    ) as Error & { statusCode: number };
    error.statusCode = 403;
    throw error;
  }
  const error = new Error(
    'Solo puede enviar comunicados a su área o a áreas con excepción de comunicados',
  ) as Error & { statusCode: number };
  error.statusCode = 403;
  throw error;
}

export async function canViewAnnouncement(
  user: AuthenticatedUser,
  row: AnnouncementRow,
): Promise<boolean> {
  if (isSystemAdmin(user)) return true;
  if (await canPublishToArea(user, row.targetAreaId)) return true;
  if (row.status !== ANNOUNCEMENT_STATUS.PUBLISHED) return false;
  if (row.targetAreaId == null) return true;
  return row.targetAreaId === user.area.id;
}

export async function canEditAnnouncement(
  user: AuthenticatedUser,
  row: AnnouncementRow,
): Promise<boolean> {
  if (isSystemAdmin(user)) return true;
  return canPublishToArea(user, row.targetAreaId);
}

export async function canManageAnnouncementRow(
  user: AuthenticatedUser,
  row: AnnouncementRow,
): Promise<boolean> {
  return canEditAnnouncement(user, row);
}
