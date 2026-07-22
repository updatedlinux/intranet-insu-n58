import bcrypt from 'bcrypt';
import { ADMIN_ROLES } from '../constants/roles';
import type { AppError } from '../middlewares/error.middleware';
import {
  findActivePositionsByArea,
  findPositionById,
  findRoleById,
} from '../repositories/catalog.repository';
import {
  createUser,
  deleteUser,
  emailExists,
  findCollaboratorById,
  getUserDeletionBlockers,
  listCollaborators,
  resetUserPassword,
  setUserActive,
  updateUser,
  type CollaboratorListFilters,
  type CollaboratorListRow,
} from '../repositories/collaborator.repository';
import type { AuthenticatedUser } from '../types/auth';
import type { AuditContext } from '../types/audit';
import { generateTemporaryPassword } from '../utils/password';
import {
  auditCollaboratorCreated,
  auditCollaboratorPasswordReset,
  auditCollaboratorStatusChanged,
  auditCollaboratorUpdated,
} from './audit.service';
import { revokeSession } from './session.service';
import { displayName, emailService, notifyEmail } from './email.service';
import { resolvePublicAvatarUrl } from '../utils/avatar-url';

export interface PublicCollaborator {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  role: { id: number; name: string };
  area: { id: number; name: string };
  position: { id: number; name: string };
  isActive: boolean;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: number | null;
  avatarUrl: string | null;
}

function forbidden(message: string): AppError {
  const error = new Error(message) as AppError;
  error.statusCode = 403;
  return error;
}

function notFound(message = 'Colaborador no encontrado'): AppError {
  const error = new Error(message) as AppError;
  error.statusCode = 404;
  return error;
}

function conflict(message: string): AppError {
  const error = new Error(message) as AppError;
  error.statusCode = 409;
  return error;
}

function toPublicCollaborator(row: CollaboratorListRow): PublicCollaborator {
  return {
    id: row.id,
    firstName: row.firstName,
    lastName: row.lastName,
    email: row.email,
    role: { id: row.roleId, name: row.roleName },
    area: { id: row.areaId, name: row.areaName },
    position: { id: row.positionId, name: row.positionName },
    isActive: row.isActive,
    mustChangePassword: row.mustChangePassword,
    lastLoginAt: row.lastLoginAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    createdBy: row.createdBy,
    avatarUrl: resolvePublicAvatarUrl(row.id, row.avatarUrl),
  };
}

async function assertAssignableRole(roleId: number, actor: AuthenticatedUser): Promise<void> {
  const role = await findRoleById(roleId);
  if (!role) {
    const error = new Error('Rol no válido') as AppError;
    error.statusCode = 400;
    throw error;
  }

  if (role.name === 'superadmin' && actor.roleName !== 'superadmin') {
    throw forbidden('No puede asignar el rol superadmin');
  }

  const allowed =
    actor.roleName === 'superadmin'
      ? ['superadmin', 'admin', 'colaborador']
      : ['admin', 'colaborador'];

  if (!allowed.includes(role.name)) {
    throw forbidden(`No puede asignar el rol ${role.name}`);
  }
}

async function assertPositionInArea(positionId: number, areaId: number): Promise<void> {
  const position = await findPositionById(positionId);
  if (!position || position.areaId !== areaId) {
    const error = new Error('El cargo no pertenece al área seleccionada') as AppError;
    error.statusCode = 400;
    throw error;
  }
}

function assertCanManageTarget(target: CollaboratorListRow, actor: AuthenticatedUser): void {
  if (target.roleName === 'superadmin' && actor.roleName !== 'superadmin') {
    throw forbidden('No puede modificar cuentas superadmin');
  }
}

export async function listCollaboratorsService(
  filters: CollaboratorListFilters,
): Promise<{ items: PublicCollaborator[]; total: number; page: number; pageSize: number }> {
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 20;
  const { items, total } = await listCollaborators({ ...filters, page, pageSize });
  return {
    items: items.map(toPublicCollaborator),
    total,
    page,
    pageSize,
  };
}

export async function getCollaboratorService(id: number): Promise<PublicCollaborator> {
  const row = await findCollaboratorById(id);
  if (!row) throw notFound();
  return toPublicCollaborator(row);
}

export async function createCollaboratorService(
  actor: AuthenticatedUser,
  data: {
    firstName: string;
    lastName: string;
    email: string;
    roleId: number;
    areaId: number;
    positionId: number;
    isActive: boolean;
  },
  auditContext?: AuditContext,
): Promise<{ collaborator: PublicCollaborator; emailSent: boolean }> {
  await assertAssignableRole(data.roleId, actor);
  await assertPositionInArea(data.positionId, data.areaId);

  if (await emailExists(data.email)) {
    throw conflict('Ya existe un usuario con ese email');
  }

  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await bcrypt.hash(temporaryPassword, 12);

  const id = await createUser({
    ...data,
    passwordHash,
    mustChangePassword: true,
    createdBy: actor.id,
  });

  const created = await findCollaboratorById(id);
  if (!created) throw notFound();

  await auditCollaboratorCreated(
    actor.id,
    created.id,
    {
      email: created.email,
      roleName: created.roleName,
      areaName: created.areaName,
      isActive: created.isActive,
    },
    auditContext,
  );

  const emailSent = await emailService.sendWelcome(
    created.email,
    displayName(created.firstName, created.lastName),
    temporaryPassword,
  );
  if (!emailSent) {
    console.warn(`[email] Bienvenida no enviada a colaborador #${created.id}`);
  }

  return {
    collaborator: toPublicCollaborator(created),
    emailSent,
  };
}

export async function updateCollaboratorService(
  actor: AuthenticatedUser,
  id: number,
  data: {
    firstName: string;
    lastName: string;
    email: string;
    roleId: number;
    areaId: number;
    positionId: number;
  },
  auditContext?: AuditContext,
): Promise<PublicCollaborator> {
  const existing = await findCollaboratorById(id);
  if (!existing) throw notFound();
  assertCanManageTarget(existing, actor);

  await assertAssignableRole(data.roleId, actor);
  await assertPositionInArea(data.positionId, data.areaId);

  if (await emailExists(data.email, id)) {
    throw conflict('Ya existe otro usuario con ese email');
  }

  await updateUser(id, data);
  const updated = await findCollaboratorById(id);
  if (!updated) throw notFound();

  await auditCollaboratorUpdated(
    actor.id,
    updated.id,
    {
      email: updated.email,
      roleName: updated.roleName,
      areaName: updated.areaName,
      positionName: updated.positionName,
    },
    auditContext,
  );

  return toPublicCollaborator(updated);
}

export async function setCollaboratorStatusService(
  actor: AuthenticatedUser,
  id: number,
  isActive: boolean,
  auditContext?: AuditContext,
): Promise<PublicCollaborator> {
  if (actor.id === id && !isActive) {
    throw forbidden('No puede inactivar su propia cuenta');
  }

  const existing = await findCollaboratorById(id);
  if (!existing) throw notFound();
  assertCanManageTarget(existing, actor);

  const wasActive = existing.isActive;

  await setUserActive(id, isActive);
  const updated = await findCollaboratorById(id);
  if (!updated) throw notFound();

  if (!isActive) {
    await revokeSession(id);
  }

  await auditCollaboratorStatusChanged(actor.id, updated.id, isActive, updated.email, auditContext);

  const fullName = displayName(updated.firstName, updated.lastName);
  if (!isActive && wasActive) {
    notifyEmail(
      () => emailService.sendAccountDeactivated(updated.email, fullName),
      `cuenta desactivada #${updated.id}`,
    );
  } else if (isActive && !wasActive) {
    notifyEmail(
      () => emailService.sendAccountActivated(updated.email, fullName),
      `cuenta reactivada #${updated.id}`,
    );
  }

  return toPublicCollaborator(updated);
}

export async function resetCollaboratorPasswordService(
  actor: AuthenticatedUser,
  id: number,
  auditContext?: AuditContext,
): Promise<{ collaborator: PublicCollaborator; emailSent: boolean }> {
  const existing = await findCollaboratorById(id);
  if (!existing) throw notFound();
  assertCanManageTarget(existing, actor);

  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await bcrypt.hash(temporaryPassword, 12);
  await resetUserPassword(id, passwordHash, true);
  await revokeSession(id);

  const updated = await findCollaboratorById(id);
  if (!updated) throw notFound();

  await auditCollaboratorPasswordReset(actor.id, updated.id, updated.email, auditContext);

  const emailSent = await emailService.sendPasswordReset(
    updated.email,
    displayName(updated.firstName, updated.lastName),
    temporaryPassword,
  );
  if (!emailSent) {
    console.warn(`[email] Reset de contraseña no enviado a colaborador #${updated.id}`);
  }

  return {
    collaborator: toPublicCollaborator(updated),
    emailSent,
  };
}

export function getAssignableRolesForActor(actorRole: string) {
  if (actorRole === 'superadmin') {
    return ['superadmin', 'admin', 'colaborador'];
  }
  if ((ADMIN_ROLES as readonly string[]).includes(actorRole)) {
    return ['admin', 'colaborador'];
  }
  return [];
}

function formatUserDeleteBlockers(
  blockers: Awaited<ReturnType<typeof getUserDeletionBlockers>>,
): string | null {
  const parts: string[] = [];
  if (blockers.tickets > 0) parts.push(`${blockers.tickets} ticket(s)`);
  if (blockers.requests > 0) parts.push(`${blockers.requests} solicitud(es)`);
  if (blockers.documents > 0) parts.push(`${blockers.documents} documento(s)`);
  if (blockers.assets > 0) parts.push(`${blockers.assets} activo(s) TI`);
  if (blockers.tasks > 0) parts.push(`${blockers.tasks} tarea(s)`);
  if (blockers.announcements > 0) parts.push(`${blockers.announcements} comunicado(s)`);
  if (blockers.meetings > 0) parts.push(`${blockers.meetings} reunión(es)`);
  if (blockers.learningCourses > 0) parts.push(`${blockers.learningCourses} curso(s)`);
  if (blockers.corporateEvents > 0) parts.push(`${blockers.corporateEvents} evento(s)`);
  if (blockers.chatMessages > 0) parts.push(`${blockers.chatMessages} mensaje(s) de chat`);
  if (blockers.consumables > 0) parts.push(`${blockers.consumables} consumible(s)`);
  if (parts.length === 0) return null;
  return `No se puede eliminar: el colaborador tiene ${parts.join(', ')} asociados`;
}

export async function deleteCollaboratorService(
  actor: AuthenticatedUser,
  id: number,
): Promise<void> {
  if (actor.id === id) {
    throw forbidden('No puede eliminar su propia cuenta');
  }

  const existing = await findCollaboratorById(id);
  if (!existing) throw notFound();
  assertCanManageTarget(existing, actor);

  const blockers = await getUserDeletionBlockers(id);
  const message = formatUserDeleteBlockers(blockers);
  if (message) {
    const error = new Error(message) as AppError;
    error.statusCode = 409;
    throw error;
  }

  await revokeSession(id);
  await deleteUser(id);
}

export async function getCatalogPositions(areaId?: number) {
  return findActivePositionsByArea(areaId);
}
