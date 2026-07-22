import { randomBytes } from 'crypto';

const TEMP_PASSWORD_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';

/** Genera contraseña temporal legible (sin caracteres ambiguos). */
export function generateTemporaryPassword(length = 12): string {
  const bytes = randomBytes(length);
  let result = '';
  for (let i = 0; i < length; i += 1) {
    result += TEMP_PASSWORD_CHARS[bytes[i]! % TEMP_PASSWORD_CHARS.length];
  }
  return result;
}
