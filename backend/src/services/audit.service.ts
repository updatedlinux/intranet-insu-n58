import { AUDIT_ACTIONS, AUDIT_ENTITY } from '../constants/audit-actions';
import { insertAuditLog } from '../repositories/audit.repository';
import type { AuditContext, CreateAuditLogInput } from '../types/audit';
import { maskEmail } from '../utils/audit-context';

type LoginFailureReason =
  | 'missing_credentials'
  | 'user_not_found'
  | 'user_inactive'
  | 'invalid_password';

async function safeWrite(input: CreateAuditLogInput): Promise<void> {
  try {
    await insertAuditLog(input);
  } catch (error) {
    console.error('[audit] Error al registrar evento:', input.action, error);
  }
}

function withContext(context?: AuditContext): Pick<CreateAuditLogInput, 'ipAddress' | 'userAgent'> {
  return {
    ipAddress: context?.ipAddress ?? null,
    userAgent: context?.userAgent ?? null,
  };
}

export async function auditLoginSuccess(
  actorUserId: number,
  email: string,
  context?: AuditContext,
): Promise<void> {
  await safeWrite({
    action: AUDIT_ACTIONS.AUTH_LOGIN_SUCCESS,
    actorUserId,
    entityType: AUDIT_ENTITY.USER,
    entityId: actorUserId,
    detail: { email: maskEmail(email) },
    ...withContext(context),
  });
}

export async function auditLoginFailed(
  email: string,
  reason: LoginFailureReason,
  context?: AuditContext,
  actorUserId?: number | null,
): Promise<void> {
  await safeWrite({
    action: AUDIT_ACTIONS.AUTH_LOGIN_FAILED,
    actorUserId: actorUserId ?? null,
    entityType: actorUserId ? AUDIT_ENTITY.USER : null,
    entityId: actorUserId ?? null,
    detail: {
      emailAttempt: maskEmail(email || 'unknown'),
      reason,
    },
    ...withContext(context),
  });
}

export async function auditLogout(actorUserId: number, context?: AuditContext): Promise<void> {
  await safeWrite({
    action: AUDIT_ACTIONS.AUTH_LOGOUT,
    actorUserId,
    entityType: AUDIT_ENTITY.USER,
    entityId: actorUserId,
    detail: { event: 'session_closed' },
    ...withContext(context),
  });
}

export async function auditCollaboratorCreated(
  actorUserId: number,
  targetUserId: number,
  summary: { email: string; roleName: string; areaName: string; isActive: boolean },
  context?: AuditContext,
): Promise<void> {
  await safeWrite({
    action: AUDIT_ACTIONS.COLLABORATOR_CREATE,
    actorUserId,
    entityType: AUDIT_ENTITY.USER,
    entityId: targetUserId,
    detail: {
      email: maskEmail(summary.email),
      role: summary.roleName,
      area: summary.areaName,
      isActive: summary.isActive,
    },
    ...withContext(context),
  });
}

export async function auditCollaboratorUpdated(
  actorUserId: number,
  targetUserId: number,
  summary: {
    email: string;
    roleName: string;
    areaName: string;
    positionName: string;
  },
  context?: AuditContext,
): Promise<void> {
  await safeWrite({
    action: AUDIT_ACTIONS.COLLABORATOR_UPDATE,
    actorUserId,
    entityType: AUDIT_ENTITY.USER,
    entityId: targetUserId,
    detail: {
      email: maskEmail(summary.email),
      role: summary.roleName,
      area: summary.areaName,
      position: summary.positionName,
    },
    ...withContext(context),
  });
}

export async function auditCollaboratorStatusChanged(
  actorUserId: number,
  targetUserId: number,
  isActive: boolean,
  targetEmail: string,
  context?: AuditContext,
): Promise<void> {
  await safeWrite({
    action: isActive ? AUDIT_ACTIONS.COLLABORATOR_ACTIVATE : AUDIT_ACTIONS.COLLABORATOR_DEACTIVATE,
    actorUserId,
    entityType: AUDIT_ENTITY.USER,
    entityId: targetUserId,
    detail: {
      email: maskEmail(targetEmail),
      isActive,
    },
    ...withContext(context),
  });
}

export async function auditCollaboratorPasswordReset(
  actorUserId: number,
  targetUserId: number,
  targetEmail: string,
  context?: AuditContext,
): Promise<void> {
  await safeWrite({
    action: AUDIT_ACTIONS.COLLABORATOR_PASSWORD_RESET,
    actorUserId,
    entityType: AUDIT_ENTITY.USER,
    entityId: targetUserId,
    detail: {
      email: maskEmail(targetEmail),
      mustChangePassword: true,
    },
    ...withContext(context),
  });
}
