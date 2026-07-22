import { getAreaAccessForSource } from '../repositories/area-access.repository';
import type { RequestRow } from '../repositories/request.repository';
import { isLeaderOfArea, isSystemAdmin } from './document-access.policy';
import type { AuthenticatedUser } from '../types/auth';

export async function getInboxAreaIds(user: AuthenticatedUser): Promise<number[] | 'all'> {
  if (isSystemAdmin(user)) return 'all';

  const ids = new Set<number>();
  for (const areaId of user.ledAreaIds) ids.add(areaId);
  if (user.position.isLeader) ids.add(user.area.id);

  const sourceIds = new Set<number>([user.area.id, ...user.ledAreaIds]);
  for (const sourceId of sourceIds) {
    const grants = await getAreaAccessForSource(sourceId);
    for (const g of grants) {
      if (g.isActive) ids.add(g.targetAreaId);
    }
  }

  return [...ids];
}

export function canAccessInbox(user: AuthenticatedUser): boolean {
  return isSystemAdmin(user) || user.ledAreaIds.length > 0 || Boolean(user.position.isLeader);
}

export async function canManageRequest(
  user: AuthenticatedUser,
  request: Pick<RequestRow, 'targetAreaId'>,
): Promise<boolean> {
  if (isSystemAdmin(user)) return true;
  if (isLeaderOfArea(user, request.targetAreaId)) return true;

  const inboxIds = await getInboxAreaIds(user);
  if (inboxIds === 'all') return true;
  return inboxIds.includes(request.targetAreaId);
}

export async function canViewRequest(
  user: AuthenticatedUser,
  request: Pick<RequestRow, 'requesterId' | 'targetAreaId'>,
): Promise<boolean> {
  if (request.requesterId === user.id) return true;
  return canManageRequest(user, request);
}

export function canCloseAsRequester(
  user: AuthenticatedUser,
  request: Pick<RequestRow, 'requesterId' | 'status'>,
): boolean {
  return request.requesterId === user.id && request.status === 'RESOLVED';
}
