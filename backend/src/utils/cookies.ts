import type { CookieOptions, Response } from 'express';
import { config } from '../config';

function parseExpiresInToMs(expiresIn: string): number {
  const match = /^(\d+)([smhd])$/.exec(expiresIn.trim());
  if (!match) {
    return 8 * 60 * 60 * 1000;
  }
  const value = Number(match[1]);
  const unit = match[2];
  const multipliers: Record<string, number> = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };
  return value * (multipliers[unit] ?? multipliers.h);
}

export function getAuthCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: 'lax',
    path: '/',
    maxAge: parseExpiresInToMs(config.jwt.expiresIn),
  };
}

export function setAuthCookie(res: Response, token: string): void {
  res.cookie(config.jwt.cookieName, token, getAuthCookieOptions());
}

export function clearAuthCookie(res: Response): void {
  res.clearCookie(config.jwt.cookieName, {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: 'lax',
    path: '/',
  });
}

export function getAuthCookieName(): string {
  return config.jwt.cookieName;
}
