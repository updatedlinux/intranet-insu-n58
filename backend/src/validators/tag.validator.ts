import type { AppError } from '../middlewares/error.middleware';

function badRequest(message: string): AppError {
  const error = new Error(message) as AppError;
  error.statusCode = 400;
  return error;
}

function requireString(value: unknown, field: string, min = 1, max = 100): string {
  if (typeof value !== 'string' || value.trim().length < min) {
    throw badRequest(`${field} es obligatorio`);
  }
  const trimmed = value.trim();
  if (trimmed.length > max) {
    throw badRequest(`${field} no puede superar ${max} caracteres`);
  }
  return trimmed;
}

function optionalString(value: unknown, max: number): string | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') throw badRequest('Valor de texto inválido');
  const trimmed = value.trim();
  if (trimmed.length > max) throw badRequest(`El texto no puede superar ${max} caracteres`);
  return trimmed.length > 0 ? trimmed : null;
}

export function validateTagBody(body: Record<string, unknown>): {
  name: string;
  description: string | null;
  isActive: boolean;
} {
  const name = requireString(body.name, 'Nombre', 2, 100);
  const description = optionalString(body.description, 500);
  const isActive = body.isActive === undefined ? true : Boolean(body.isActive);
  return { name, description, isActive };
}

export function validateTagToggleBody(body: Record<string, unknown>): boolean {
  if (typeof body.isActive !== 'boolean') {
    throw badRequest('isActive debe ser booleano');
  }
  return body.isActive;
}

export function parseTagListQuery(query: Record<string, unknown>): {
  name?: string;
  isActive?: boolean;
} {
  const filters: { name?: string; isActive?: boolean } = {};
  if (typeof query.name === 'string' && query.name.trim()) {
    filters.name = query.name.trim();
  }
  if (query.isActive === 'true') filters.isActive = true;
  if (query.isActive === 'false') filters.isActive = false;
  return filters;
}
