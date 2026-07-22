import type { Request } from 'express';
import type { AuditContext } from '../types/audit';

const MAX_USER_AGENT_LENGTH = 500;

function truncate(value: string, max: number): string {
  return value.length > max ? value.slice(0, max) : value;
}

/** Enmascara la parte local del email para bitácora (sin exponer credenciales). */
export function maskEmail(email: string): string {
  const normalized = email.trim().toLowerCase();
  const atIndex = normalized.indexOf('@');
  if (atIndex <= 0) return '***';
  const local = normalized.slice(0, atIndex);
  const domain = normalized.slice(atIndex + 1);
  const visible = local.length <= 1 ? '*' : `${local.charAt(0)}***`;
  return `${visible}@${domain}`;
}

/** Elimina claves sensibles antes de serializar detalle de auditoría. */
export function sanitizeAuditDetail(detail: Record<string, unknown>): Record<string, unknown> {
  const blocked = new Set([
    'password',
    'currentpassword',
    'newpassword',
    'confirmpassword',
    'passwordhash',
    'temporarypassword',
    'token',
  ]);

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(detail)) {
    if (blocked.has(key.toLowerCase())) continue;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      result[key] = sanitizeAuditDetail(value as Record<string, unknown>);
    } else {
      result[key] = value;
    }
  }
  return result;
}

export function getAuditContext(req: Request): AuditContext {
  const forwarded = req.headers['x-forwarded-for'];
  const rawIp =
    (typeof forwarded === 'string' ? forwarded.split(',')[0]?.trim() : undefined) ||
    req.ip ||
    req.socket.remoteAddress ||
    undefined;

  return {
    ipAddress: rawIp ? truncate(rawIp, 45) : undefined,
    userAgent: req.get('user-agent')
      ? truncate(req.get('user-agent')!, MAX_USER_AGENT_LENGTH)
      : undefined,
  };
}
