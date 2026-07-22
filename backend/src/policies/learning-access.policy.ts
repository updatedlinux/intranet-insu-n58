import { getAreaAccessForSource } from '../repositories/area-access.repository';
import { isAreaLeader, isLeaderOfArea, isSystemAdmin } from './document-access.policy';
import type { AuthenticatedUser } from '../types/auth';

export function canManageLearning(user: AuthenticatedUser): boolean {
  return isSystemAdmin(user) || isAreaLeader(user);
}

/** Áreas donde el líder puede gobernar cursos: liderazgo directo + excepciones entre áreas. */
export async function getManageableLearningAreaIds(
  user: AuthenticatedUser,
): Promise<number[] | 'all'> {
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

export async function canManageLearningInArea(
  user: AuthenticatedUser,
  areaId: number,
): Promise<boolean> {
  if (isSystemAdmin(user)) return true;
  if (isLeaderOfArea(user, areaId)) return true;

  const manageable = await getManageableLearningAreaIds(user);
  if (manageable === 'all') return true;
  return manageable.includes(areaId);
}

export async function canManageLearningCourseAreas(
  user: AuthenticatedUser,
  courseAreaIds: number[],
): Promise<boolean> {
  if (isSystemAdmin(user)) return true;
  if (courseAreaIds.length === 0) return false;

  for (const areaId of courseAreaIds) {
    if (!(await canManageLearningInArea(user, areaId))) return false;
  }
  return true;
}

export async function assertLearningAreasAllowed(
  user: AuthenticatedUser,
  areaIds: number[],
): Promise<void> {
  if (isSystemAdmin(user)) return;

  for (const areaId of areaIds) {
    if (!(await canManageLearningInArea(user, areaId))) {
      const error = new Error(
        'Solo puede asignar cursos a áreas bajo su liderazgo o con excepción de acceso entre áreas',
      ) as Error & { statusCode: number };
      error.statusCode = 403;
      throw error;
    }
  }
}

export async function assertCanManageLearningCourseAreas(
  user: AuthenticatedUser,
  courseAreaIds: number[],
): Promise<void> {
  if (isSystemAdmin(user)) return;

  if (!(await canManageLearningCourseAreas(user, courseAreaIds))) {
    const error = new Error('No tiene permisos para gestionar este curso') as Error & {
      statusCode: number;
    };
    error.statusCode = 403;
    throw error;
  }
}
