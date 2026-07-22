import type { AppError } from '../middlewares/error.middleware';

const MIN_PASSWORD_LENGTH = 8;

export interface ChangePasswordPayload {
  currentPassword?: string;
  newPassword?: string;
  confirmPassword?: string;
}

function badRequest(message: string): AppError {
  const error = new Error(message) as AppError;
  error.statusCode = 400;
  return error;
}

export function validateChangePasswordBody(body: ChangePasswordPayload): {
  currentPassword: string;
  newPassword: string;
} {
  const currentPassword = typeof body.currentPassword === 'string' ? body.currentPassword : '';
  const newPassword = typeof body.newPassword === 'string' ? body.newPassword : '';
  const confirmPassword = typeof body.confirmPassword === 'string' ? body.confirmPassword : '';

  if (!currentPassword) {
    throw badRequest('La contraseña actual es obligatoria');
  }

  if (!newPassword || newPassword.length < MIN_PASSWORD_LENGTH) {
    throw badRequest(`La nueva contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres`);
  }

  if (newPassword !== confirmPassword) {
    throw badRequest('La confirmación de contraseña no coincide');
  }

  if (currentPassword === newPassword) {
    throw badRequest('La nueva contraseña debe ser diferente a la actual');
  }

  return { currentPassword, newPassword };
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateForgotPasswordBody(body: { email?: string }): string {
  const email = typeof body.email === 'string' ? body.email.trim() : '';
  if (!email || !EMAIL_PATTERN.test(email)) {
    throw badRequest('Ingrese un correo electrónico válido');
  }
  return email.toLowerCase();
}

export function validateResetPasswordBody(body: {
  token?: string;
  newPassword?: string;
  confirmPassword?: string;
}): { token: string; newPassword: string } {
  const token = typeof body.token === 'string' ? body.token.trim() : '';
  const newPassword = typeof body.newPassword === 'string' ? body.newPassword : '';
  const confirmPassword = typeof body.confirmPassword === 'string' ? body.confirmPassword : '';

  if (!token) {
    throw badRequest('El enlace de recuperación no es válido');
  }

  if (!newPassword || newPassword.length < MIN_PASSWORD_LENGTH) {
    throw badRequest(`La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres`);
  }

  if (newPassword !== confirmPassword) {
    throw badRequest('La confirmación de contraseña no coincide');
  }

  return { token, newPassword };
}
