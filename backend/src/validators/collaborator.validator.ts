import type { AppError } from '../middlewares/error.middleware';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface CollaboratorPayload {
  firstName?: string;
  lastName?: string;
  email?: string;
  roleId?: number;
  areaId?: number;
  positionId?: number;
  isActive?: boolean;
}

function badRequest(message: string): AppError {
  const error = new Error(message) as AppError;
  error.statusCode = 400;
  return error;
}

function requireString(value: unknown, field: string, min = 2, max = 100): string {
  if (typeof value !== 'string' || value.trim().length < min) {
    throw badRequest(`${field} es obligatorio (mínimo ${min} caracteres)`);
  }
  const trimmed = value.trim();
  if (trimmed.length > max) {
    throw badRequest(`${field} no puede superar ${max} caracteres`);
  }
  return trimmed;
}

function requireId(value: unknown, field: string): number {
  const num = typeof value === 'string' ? Number.parseInt(value, 10) : value;
  if (typeof num !== 'number' || !Number.isInteger(num) || num <= 0) {
    throw badRequest(`${field} inválido`);
  }
  return num;
}

export function validateCollaboratorBody(
  body: CollaboratorPayload,
  isCreate: boolean,
): {
  firstName: string;
  lastName: string;
  email: string;
  roleId: number;
  areaId: number;
  positionId: number;
  isActive: boolean;
} {
  const firstName = requireString(body.firstName, 'Nombre');
  const lastName = requireString(body.lastName, 'Apellido');
  const email = requireString(body.email, 'Email', 5, 255).toLowerCase();

  if (!EMAIL_REGEX.test(email)) {
    throw badRequest('Email inválido');
  }

  const roleId = requireId(body.roleId, 'Rol');
  const areaId = requireId(body.areaId, 'Área');
  const positionId = requireId(body.positionId, 'Cargo');

  let isActive = true;
  if (body.isActive !== undefined) {
    if (typeof body.isActive !== 'boolean') {
      throw badRequest('Estado inválido');
    }
    isActive = body.isActive;
  } else if (!isCreate) {
    isActive = true;
  }

  return { firstName, lastName, email, roleId, areaId, positionId, isActive };
}

export function validateStatusBody(body: { isActive?: unknown }): boolean {
  if (typeof body.isActive !== 'boolean') {
    throw badRequest('Debe indicar isActive como booleano');
  }
  return body.isActive;
}

export function parseListQuery(query: Record<string, unknown>): {
  search?: string;
  email?: string;
  roleId?: number;
  isActive?: boolean;
  areaId?: number;
  positionId?: number;
  page: number;
  pageSize: number;
} {
  const pageRaw = query.page;
  const pageSizeRaw = query.pageSize;
  const page =
    typeof pageRaw === 'string' && pageRaw ? Math.max(1, Number.parseInt(pageRaw, 10) || 1) : 1;
  const pageSize =
    typeof pageSizeRaw === 'string' && pageSizeRaw
      ? Math.min(100, Math.max(1, Number.parseInt(pageSizeRaw, 10) || 20))
      : 20;

  const result: ReturnType<typeof parseListQuery> = { page, pageSize };

  if (typeof query.search === 'string' && query.search.trim()) {
    result.search = query.search.trim();
  }
  if (typeof query.email === 'string' && query.email.trim()) {
    result.email = query.email.trim();
  }
  if (typeof query.roleId === 'string' && query.roleId) {
    const roleId = Number.parseInt(query.roleId, 10);
    if (!Number.isNaN(roleId)) result.roleId = roleId;
  }
  if (query.isActive === 'true') result.isActive = true;
  if (query.isActive === 'false') result.isActive = false;
  if (typeof query.areaId === 'string' && query.areaId) {
    const areaId = Number.parseInt(query.areaId, 10);
    if (!Number.isNaN(areaId)) result.areaId = areaId;
  }
  if (typeof query.positionId === 'string' && query.positionId) {
    const positionId = Number.parseInt(query.positionId, 10);
    if (!Number.isNaN(positionId)) result.positionId = positionId;
  }

  return result;
}

export function parseIdParam(value: string | string[]): number {
  const raw = Array.isArray(value) ? value[0] : value;
  const id = Number.parseInt(raw ?? '', 10);
  if (!Number.isInteger(id) || id <= 0) {
    throw badRequest('Identificador inválido');
  }
  return id;
}
