/** Códigos de acción para la bitácora de auditoría */
export const AUDIT_ACTIONS = {
  AUTH_LOGIN_SUCCESS: 'auth.login.success',
  AUTH_LOGIN_FAILED: 'auth.login.failed',
  AUTH_LOGOUT: 'auth.logout',
  COLLABORATOR_CREATE: 'collaborator.create',
  COLLABORATOR_UPDATE: 'collaborator.update',
  COLLABORATOR_ACTIVATE: 'collaborator.activate',
  COLLABORATOR_DEACTIVATE: 'collaborator.deactivate',
  COLLABORATOR_PASSWORD_RESET: 'collaborator.password.reset',
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];

export const AUDIT_ENTITY = {
  USER: 'User',
} as const;

export type AuditEntityType = (typeof AUDIT_ENTITY)[keyof typeof AUDIT_ENTITY];
