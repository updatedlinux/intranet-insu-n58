import type { AppError } from '../middlewares/error.middleware';
import type { AreaDeleteOptions } from '../services/area.service';

export interface AreaPayload {
  name?: string;
  description?: string | null;
  parentAreaId?: number | null;
  isActive?: boolean;
  isItSupportArea?: boolean;
  leaderIds?: number[];
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

function optionalDescription(value: unknown): string | null {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  if (typeof value !== 'string') {
    throw badRequest('Descripción inválida');
  }
  const trimmed = value.trim();
  if (trimmed.length > 500) {
    throw badRequest('La descripción no puede superar 500 caracteres');
  }
  return trimmed.length > 0 ? trimmed : null;
}

function optionalParentId(value: unknown): number | null {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  const num = typeof value === 'string' ? Number.parseInt(value, 10) : value;
  if (typeof num !== 'number' || !Number.isInteger(num) || num <= 0) {
    throw badRequest('Área padre inválida');
  }
  return num;
}

function optionalLeaderIds(value: unknown): number[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    throw badRequest('Líderes inválidos');
  }
  const ids: number[] = [];
  for (const item of value) {
    const num = typeof item === 'string' ? Number.parseInt(item, 10) : item;
    if (typeof num !== 'number' || !Number.isInteger(num) || num <= 0) {
      throw badRequest('Identificador de líder inválido');
    }
    if (!ids.includes(num)) ids.push(num);
  }
  return ids;
}

export function validateAreaBody(
  body: AreaPayload,
  isCreate: boolean,
): {
  name: string;
  description: string | null;
  parentAreaId: number | null;
  isActive: boolean;
  isItSupportArea: boolean;
  leaderIds: number[];
} {
  const name = requireString(body.name, 'Nombre');
  const description = optionalDescription(body.description);
  const parentAreaId = optionalParentId(body.parentAreaId);

  let isActive = true;
  if (body.isActive !== undefined) {
    if (typeof body.isActive !== 'boolean') {
      throw badRequest('Estado inválido');
    }
    isActive = body.isActive;
  } else if (!isCreate) {
    isActive = true;
  }

  let isItSupportArea = false;
  if (body.isItSupportArea !== undefined) {
    if (typeof body.isItSupportArea !== 'boolean') {
      throw badRequest('Indicador de área TI inválido');
    }
    isItSupportArea = body.isItSupportArea;
  }

  return {
    name,
    description,
    parentAreaId,
    isActive,
    isItSupportArea,
    leaderIds: optionalLeaderIds(body.leaderIds),
  };
}

export function validateToggleBody(body: { isActive?: unknown }): boolean {
  if (typeof body.isActive !== 'boolean') {
    throw badRequest('Debe indicar isActive como booleano');
  }
  return body.isActive;
}

export function parseAreaListQuery(query: Record<string, unknown>): {
  name?: string;
  isActive?: boolean;
} {
  const result: { name?: string; isActive?: boolean } = {};

  if (typeof query.name === 'string' && query.name.trim()) {
    result.name = query.name.trim();
  }
  if (query.isActive === 'true') result.isActive = true;
  if (query.isActive === 'false') result.isActive = false;

  return result;
}

export { parseIdParam } from './collaborator.validator';

export function validateAreaDeleteBody(body: {
  taskAction?: unknown;
  transferToAreaId?: unknown;
}): AreaDeleteOptions {
  const result: AreaDeleteOptions = {};

  if (body.taskAction === undefined || body.taskAction === null || body.taskAction === '') {
    return result;
  }

  if (body.taskAction !== 'transfer' && body.taskAction !== 'delete') {
    throw badRequest('taskAction debe ser "transfer" o "delete"');
  }

  result.taskAction = body.taskAction;

  if (body.taskAction === 'transfer') {
    const transferToAreaId =
      typeof body.transferToAreaId === 'string'
        ? Number.parseInt(body.transferToAreaId, 10)
        : body.transferToAreaId;
    if (
      typeof transferToAreaId !== 'number' ||
      !Number.isInteger(transferToAreaId) ||
      transferToAreaId <= 0
    ) {
      throw badRequest('transferToAreaId es obligatorio al transferir tareas');
    }
    result.transferToAreaId = transferToAreaId;
  }

  return result;
}
