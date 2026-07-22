import type { AppError } from '../middlewares/error.middleware';

export interface PositionPayload {
  name?: string;
  areaId?: number;
  isLeader?: boolean;
  isActive?: boolean;
}

function badRequest(message: string): AppError {
  const error = new Error(message) as AppError;
  error.statusCode = 400;
  return error;
}

function requireString(value: unknown, field: string, min = 2, max = 200): string {
  if (typeof value !== 'string' || value.trim().length < min) {
    throw badRequest(`${field} es obligatorio (mínimo ${min} caracteres)`);
  }
  const trimmed = value.trim();
  if (trimmed.length > max) {
    throw badRequest(`${field} no puede superar ${max} caracteres`);
  }
  return trimmed;
}

function requireAreaId(value: unknown): number {
  const num = typeof value === 'string' ? Number.parseInt(value, 10) : value;
  if (typeof num !== 'number' || !Number.isInteger(num) || num <= 0) {
    throw badRequest('Área inválida');
  }
  return num;
}

export function validatePositionBody(
  body: PositionPayload,
  isCreate: boolean,
): {
  name: string;
  areaId: number;
  isLeader: boolean;
  isActive: boolean;
} {
  const name = requireString(body.name, 'Nombre');
  const areaId = requireAreaId(body.areaId);

  let isLeader = false;
  if (body.isLeader !== undefined) {
    if (typeof body.isLeader !== 'boolean') {
      throw badRequest('isLeader inválido');
    }
    isLeader = body.isLeader;
  }

  let isActive = true;
  if (body.isActive !== undefined) {
    if (typeof body.isActive !== 'boolean') {
      throw badRequest('Estado inválido');
    }
    isActive = body.isActive;
  } else if (!isCreate) {
    isActive = true;
  }

  return { name, areaId, isLeader, isActive };
}

export function validateToggleBody(body: { isActive?: unknown }): boolean {
  if (typeof body.isActive !== 'boolean') {
    throw badRequest('Debe indicar isActive como booleano');
  }
  return body.isActive;
}

export function parsePositionListQuery(query: Record<string, unknown>): {
  name?: string;
  areaId?: number;
  isActive?: boolean;
} {
  const result: { name?: string; areaId?: number; isActive?: boolean } = {};

  if (typeof query.name === 'string' && query.name.trim()) {
    result.name = query.name.trim();
  }
  if (typeof query.areaId === 'string' && query.areaId) {
    const areaId = Number.parseInt(query.areaId, 10);
    if (!Number.isNaN(areaId)) result.areaId = areaId;
  }
  if (query.isActive === 'true') result.isActive = true;
  if (query.isActive === 'false') result.isActive = false;

  return result;
}

export { parseIdParam } from './collaborator.validator';
