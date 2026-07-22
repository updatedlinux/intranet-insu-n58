import bcrypt from 'bcrypt';
import { listLedAreasByUserId } from '../repositories/area-leader.repository';
import {
  findUserByEmail,
  findUserById,
  updateLastLogin,
  updateUserPassword,
  type UserRecord,
} from '../repositories/user.repository';
import type { AppError } from '../middlewares/error.middleware';
import type { AuthenticatedUser, LoginResult, PublicUser } from '../types/auth';
import type { AuditContext } from '../types/audit';
import { signAccessToken } from '../utils/jwt';
import {
  clearLoginAttempts,
  normalizeLoginEmail,
  recordLoginFailure,
} from './login-rate-limit.service';
import { createSession, revokeSession } from './session.service';
import { auditLoginFailed, auditLoginSuccess } from './audit.service';
import { resolvePublicAvatarUrl } from '../utils/avatar-url';

function toPublicUserBase(
  record: UserRecord,
  ledAreas: { id: number; name: string }[],
): PublicUser {
  return {
    id: record.id,
    firstName: record.firstName,
    lastName: record.lastName,
    email: record.email,
    role: { id: record.roleId, name: record.roleName },
    area: { id: record.areaId, name: record.areaName },
    position: {
      id: record.positionId,
      name: record.positionName,
      isLeader: record.positionIsLeader,
    },
    ledAreaIds: ledAreas.map((a) => a.id),
    ledAreas,
    isItSupportAgent: Boolean(record.areaIsItSupport),
    isActive: record.isActive,
    mustChangePassword: record.mustChangePassword,
    lastLoginAt: record.lastLoginAt?.toISOString() ?? null,
    avatarUrl: resolvePublicAvatarUrl(record.id, record.avatarUrl),
  };
}

export async function toPublicUser(record: UserRecord): Promise<PublicUser> {
  const ledAreas = await listLedAreasByUserId(record.id);
  return toPublicUserBase(record, ledAreas);
}

export async function toAuthenticatedUser(record: UserRecord): Promise<AuthenticatedUser> {
  const publicUser = await toPublicUser(record);
  return {
    ...publicUser,
    roleName: record.roleName,
  };
}

function unauthorized(message = 'Credenciales inválidas'): AppError {
  const error = new Error(message) as AppError;
  error.statusCode = 401;
  return error;
}

export async function login(
  email: string,
  password: string,
  auditContext?: AuditContext,
): Promise<LoginResult & { token: string }> {
  const normalizedEmail = normalizeLoginEmail(email);
  if (!normalizedEmail || !password) {
    await recordLoginFailure(normalizedEmail || 'unknown');
    await auditLoginFailed(normalizedEmail || 'unknown', 'missing_credentials', auditContext);
    throw unauthorized();
  }

  const user = await findUserByEmail(normalizedEmail);
  if (!user) {
    await recordLoginFailure(normalizedEmail);
    await auditLoginFailed(normalizedEmail, 'user_not_found', auditContext);
    throw unauthorized();
  }

  if (!user.isActive) {
    await recordLoginFailure(normalizedEmail);
    await auditLoginFailed(normalizedEmail, 'user_inactive', auditContext, user.id);
    throw unauthorized();
  }

  const passwordMatches = await bcrypt.compare(password, user.passwordHash);
  if (!passwordMatches) {
    await recordLoginFailure(normalizedEmail);
    await auditLoginFailed(normalizedEmail, 'invalid_password', auditContext, user.id);
    throw unauthorized();
  }

  await updateLastLogin(user.id);

  const refreshed = (await findUserById(user.id)) ?? user;
  await auditLoginSuccess(refreshed.id, refreshed.email, auditContext);

  const { token, jti } = signAccessToken({
    sub: refreshed.id,
    email: refreshed.email,
    role: refreshed.roleName,
  });

  await createSession(refreshed.id, jti);
  await clearLoginAttempts(normalizedEmail);

  return {
    user: await toPublicUser(refreshed),
    mustChangePassword: refreshed.mustChangePassword,
    token,
  };
}

export async function logoutSession(userId: number): Promise<void> {
  await revokeSession(userId);
}

export async function getAuthenticatedUser(userId: number): Promise<AuthenticatedUser> {
  const user = await findUserById(userId);
  if (!user || !user.isActive) {
    const error = new Error('Sesión inválida o usuario inactivo') as AppError;
    error.statusCode = 401;
    throw error;
  }
  return await toAuthenticatedUser(user);
}

export async function changePassword(
  userId: number,
  currentPassword: string,
  newPassword: string,
): Promise<PublicUser> {
  const user = await findUserById(userId);
  if (!user || !user.isActive) {
    const error = new Error('Sesión inválida o usuario inactivo') as AppError;
    error.statusCode = 401;
    throw error;
  }

  const passwordMatches = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!passwordMatches) {
    const error = new Error('La contraseña actual es incorrecta') as AppError;
    error.statusCode = 400;
    throw error;
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);
  await updateUserPassword(userId, passwordHash, false);

  const updated = await findUserById(userId);
  if (!updated) {
    const error = new Error('No se pudo actualizar la contraseña') as AppError;
    error.statusCode = 500;
    throw error;
  }

  return await toPublicUser(updated);
}
