import {
  canApproveInArea,
  canReadArea,
  getReadableAreaIds,
  isAreaLeader,
  isLeaderOfArea,
  isCollaboratorOnly,
  isSystemAdmin,
} from './document-access.policy';
import type { BoardRow } from '../repositories/board.repository';
import type { TaskRow } from '../repositories/task.repository';
import type { AuthenticatedUser } from '../types/auth';
import { isUserAssignedToTask } from '../repositories/task.repository';

export async function getAccessibleBoardAreaIds(user: AuthenticatedUser): Promise<number[]> {
  if (isSystemAdmin(user)) {
    return [];
  }
  return getReadableAreaIds(user);
}

export async function canAccessBoard(user: AuthenticatedUser, board: BoardRow): Promise<boolean> {
  if (isSystemAdmin(user)) return true;
  return canReadArea(user, board.areaId);
}

export async function canManageBoard(user: AuthenticatedUser, board: BoardRow): Promise<boolean> {
  if (isSystemAdmin(user)) return true;
  if (!isAreaLeader(user)) return false;
  if (isLeaderOfArea(user, board.areaId)) return true;
  return canApproveInArea(user, board.areaId);
}

export async function getAssignableAreaIdsForBoard(
  user: AuthenticatedUser,
  boardAreaId: number,
): Promise<number[]> {
  if (isSystemAdmin(user)) return [boardAreaId];
  if (isCollaboratorOnly(user)) return [user.area.id];
  if (isLeaderOfArea(user, boardAreaId)) {
    const ids = new Set<number>([boardAreaId]);
    const readable = await getReadableAreaIds(user);
    for (const id of readable) ids.add(id);
    return [...ids];
  }
  if (await canApproveInArea(user, boardAreaId)) {
    return [boardAreaId];
  }
  return [user.area.id];
}

export async function canAssignUserToBoardTask(
  user: AuthenticatedUser,
  boardAreaId: number,
  targetUserAreaId: number,
): Promise<boolean> {
  const allowedAreas = await getAssignableAreaIdsForBoard(user, boardAreaId);
  if (!allowedAreas.includes(targetUserAreaId)) return false;
  if (isCollaboratorOnly(user)) {
    return targetUserAreaId === user.area.id;
  }
  return true;
}

export async function canMoveTask(
  user: AuthenticatedUser,
  task: TaskRow,
  board: BoardRow,
): Promise<boolean> {
  if (!(await canAccessBoard(user, board))) return false;
  if (await canManageBoard(user, board)) return true;
  if (task.createdBy === user.id) return true;
  return isUserAssignedToTask(task.id, user.id);
}

export async function canEditTask(
  user: AuthenticatedUser,
  task: TaskRow,
  board: BoardRow,
): Promise<boolean> {
  if (!(await canAccessBoard(user, board))) return false;
  if (await canManageBoard(user, board)) return true;
  if (task.createdBy === user.id) return true;
  return isUserAssignedToTask(task.id, user.id);
}

export async function canArchiveTask(user: AuthenticatedUser, board: BoardRow): Promise<boolean> {
  return canManageBoard(user, board);
}
