import type { AppError } from '../middlewares/error.middleware';

function badRequest(message: string): AppError {
  const e = new Error(message) as AppError;
  e.statusCode = 400;
  return e;
}

function requireString(v: unknown, field: string, max: number): string {
  if (typeof v !== 'string' || !v.trim()) throw badRequest(`${field} es obligatorio`);
  const t = v.trim();
  if (t.length > max) throw badRequest(`${field} demasiado largo`);
  return t;
}

function optString(v: unknown, max: number): string | null {
  if (v == null || v === '') return null;
  if (typeof v !== 'string') throw badRequest('Texto inválido');
  const t = v.trim();
  if (t.length > max) throw badRequest('Texto demasiado largo');
  return t || null;
}

export function parseCategoryNameFilter(q: Record<string, unknown>): { name?: string } {
  return {
    name: typeof q.name === 'string' && q.name.trim() ? q.name.trim() : undefined,
  };
}

export function validateAssetCategoryBody(body: Record<string, unknown>) {
  return {
    name: requireString(body.name, 'Nombre', 100),
    description: optString(body.description, 500),
  };
}

export function validateConsumableCategoryBody(body: Record<string, unknown>) {
  return {
    name: requireString(body.name, 'Nombre', 100),
    description: optString(body.description, 500),
  };
}
