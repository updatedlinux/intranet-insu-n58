/** Roles con acceso a panel de administración */
export const ADMIN_ROLES = ['superadmin', 'admin'] as const;

/** Rol estándar de colaborador */
export const COLLABORATOR_ROLE = 'colaborador';

export type AdminRole = (typeof ADMIN_ROLES)[number];

export function isAdminRole(roleName: string): boolean {
  return (ADMIN_ROLES as readonly string[]).includes(roleName);
}

export function isCollaboratorRole(roleName: string): boolean {
  return roleName === COLLABORATOR_ROLE;
}
