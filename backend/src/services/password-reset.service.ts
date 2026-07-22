import { randomUUID } from 'node:crypto';
import bcrypt from 'bcrypt';
import type { AppError } from '../middlewares/error.middleware';
import { findUserByEmail, updateUserPassword } from '../repositories/user.repository';
import { getRedis, redis } from '../config/redis';
import { config } from '../config';
import { emailService, displayName } from './email.service';
import {
  isForgotPasswordBlocked,
  normalizeLoginEmail,
  recordForgotPasswordAttempt,
} from './forgot-password-rate-limit.service';
import { revokeSession } from './session.service';

const RESET_TOKEN_PREFIX = 'pwd-reset:';
const RESET_TOKEN_TTL_SECONDS = 60 * 60;

function resetKey(token: string): string {
  return `${RESET_TOKEN_PREFIX}${token}`;
}

function buildResetUrl(token: string): string {
  const base = (config.corsOrigin || 'http://localhost:5173').replace(/\/$/, '');
  return `${base}/restablecer-contrasena?token=${encodeURIComponent(token)}`;
}

function serviceUnavailable(message: string): AppError {
  const error = new Error(message) as AppError;
  error.statusCode = 503;
  return error;
}

function badRequest(message: string): AppError {
  const error = new Error(message) as AppError;
  error.statusCode = 400;
  return error;
}

const GENERIC_FORGOT_MESSAGE =
  'Si el correo está registrado y la cuenta está activa, recibirá un enlace para restablecer su contraseña en los próximos minutos.';

export async function requestPasswordReset(email: string): Promise<{ message: string }> {
  const normalizedEmail = normalizeLoginEmail(email);

  if (!redis.isReady()) {
    throw serviceUnavailable(
      'El servicio de recuperación no está disponible en este momento. Intente más tarde o contacte a soporte.',
    );
  }

  if (await isForgotPasswordBlocked(normalizedEmail)) {
    return { message: GENERIC_FORGOT_MESSAGE };
  }

  await recordForgotPasswordAttempt(normalizedEmail);

  const user = await findUserByEmail(normalizedEmail);
  if (!user?.isActive) {
    return { message: GENERIC_FORGOT_MESSAGE };
  }

  const token = randomUUID();
  await getRedis().set(resetKey(token), String(user.id), 'EX', RESET_TOKEN_TTL_SECONDS);

  const resetUrl = buildResetUrl(token);
  const nombre = displayName(user.firstName, user.lastName);

  void emailService
    .sendForgotPasswordLink(user.email, nombre, resetUrl)
    .catch((err) => console.error('[password-reset] Error al enviar correo:', err));

  return { message: GENERIC_FORGOT_MESSAGE };
}

export async function resetPasswordWithToken(
  token: string,
  newPassword: string,
): Promise<{ message: string }> {
  if (!redis.isReady()) {
    throw serviceUnavailable('No se pudo completar el restablecimiento. Intente más tarde.');
  }

  const trimmedToken = token.trim();
  if (!trimmedToken) {
    throw badRequest('El enlace de recuperación no es válido');
  }

  const userIdRaw = await getRedis().get(resetKey(trimmedToken));
  if (!userIdRaw) {
    throw badRequest('El enlace ha expirado o no es válido. Solicite uno nuevo.');
  }

  const userId = Number.parseInt(userIdRaw, 10);
  if (!Number.isFinite(userId)) {
    throw badRequest('El enlace de recuperación no es válido');
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);
  await updateUserPassword(userId, passwordHash, false);
  await getRedis().del(resetKey(trimmedToken));
  await revokeSession(userId);

  return { message: 'Contraseña actualizada. Ya puede iniciar sesión con su nueva contraseña.' };
}
