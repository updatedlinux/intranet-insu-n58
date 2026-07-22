import { randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import type { AccessTokenPayload } from '../types/auth';

export type SignAccessTokenInput = Omit<AccessTokenPayload, 'jti'>;

export function signAccessToken(payload: SignAccessTokenInput): { token: string; jti: string } {
  const jti = randomUUID();
  const token = jwt.sign({ ...payload, jti }, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn as jwt.SignOptions['expiresIn'],
  });
  return { token, jti };
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  const decoded = jwt.verify(token, config.jwt.secret);
  if (typeof decoded === 'string') {
    throw new Error('Token inválido');
  }

  const jti = decoded.jti;
  if (typeof jti !== 'string' || !jti) {
    throw new Error('Token sin identificador de sesión');
  }

  return {
    sub: Number(decoded.sub),
    email: String(decoded.email),
    role: String(decoded.role),
    jti,
  };
}
