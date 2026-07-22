export const ADMIN_ROLES = ['superadmin', 'admin'] as const;
export const COLLABORATOR_ROLE = 'colaborador';

export function isAdminRole(roleName: string): boolean {
  return (ADMIN_ROLES as readonly string[]).includes(roleName);
}

export function isCollaboratorRole(roleName: string): boolean {
  return roleName === COLLABORATOR_ROLE;
}

export function isAreaLeader(user: {
  position: { isLeader?: boolean };
  ledAreaIds?: number[];
}): boolean {
  return (user.ledAreaIds?.length ?? 0) > 0 || Boolean(user.position.isLeader);
}

/** Líderes de área y administradores del sistema pueden ver métricas de actividades. */
export function canViewActivityMetrics(user: {
  role: { name: string };
  position: { isLeader?: boolean };
  ledAreaIds?: number[];
}): boolean {
  return isAreaLeader(user) || isAdminRole(user.role.name);
}

/** Administradores y líderes de área pueden gestionar N58 Learning. */
export function canManageLearning(user: {
  role: { name: string };
  position: { isLeader?: boolean };
  ledAreaIds?: number[];
}): boolean {
  return isAreaLeader(user) || isAdminRole(user.role.name);
}

export function getRoleLabel(roleName: string): string {
  if (isAdminRole(roleName)) return 'Administrador';
  if (isCollaboratorRole(roleName)) return 'Colaborador';
  return roleName;
}
