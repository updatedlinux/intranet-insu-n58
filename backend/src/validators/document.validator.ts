import type { AppError } from '../middlewares/error.middleware';

function badRequest(message: string): AppError {
  const error = new Error(message) as AppError;
  error.statusCode = 400;
  return error;
}

function requireString(value: unknown, field: string, min = 1, max = 255): string {
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

function requireId(value: unknown, field: string): number {
  const num = typeof value === 'string' ? Number.parseInt(value, 10) : value;
  if (typeof num !== 'number' || !Number.isInteger(num) || num <= 0) {
    throw badRequest(`${field} inválido`);
  }
  return num;
}

function optionalId(value: unknown): number | null {
  if (value === undefined || value === null || value === '') return null;
  return requireId(value, 'Área');
}

export function parseFolderIdParam(value: string | undefined): number | null {
  if (!value || value === 'root') return null;
  return requireId(value, 'Carpeta');
}

export function validateCreateFolderBody(body: Record<string, unknown>): {
  name: string;
  description: string | null;
  parentFolderId: number;
  areaId: number | null;
} {
  const name = requireString(body.name, 'Nombre', 2, 200);
  const description = optionalString(body.description, 500);
  const parentFolderId = requireId(body.parentFolderId, 'Carpeta padre');
  const areaId = optionalId(body.areaId);
  return { name, description, parentFolderId, areaId };
}

export function parseTagIdsInput(raw: unknown): number[] {
  if (raw === undefined || raw === null || raw === '') return [];

  const toIds = (values: unknown[]): number[] => {
    const ids = values
      .map((v) => {
        const n = typeof v === 'string' ? Number.parseInt(v, 10) : Number(v);
        return Number.isInteger(n) && n > 0 ? n : null;
      })
      .filter((n): n is number => n != null);
    return [...new Set(ids)];
  };

  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed) as unknown;
        if (!Array.isArray(parsed)) throw badRequest('tagIds debe ser un arreglo JSON');
        return toIds(parsed);
      } catch {
        throw badRequest('Formato de tagIds JSON inválido');
      }
    }
    return toIds(trimmed.split(','));
  }

  if (Array.isArray(raw)) {
    return toIds(raw);
  }

  throw badRequest('tagIds inválidos');
}

export function parseBrowseQuery(query: Record<string, unknown>): {
  search?: string;
  tagIds?: number[];
} {
  const filters: { search?: string; tagIds?: number[] } = {};
  if (typeof query.q === 'string' && query.q.trim()) {
    filters.search = query.q.trim();
  }
  if (query.tagIds !== undefined) {
    filters.tagIds = parseTagIdsInput(query.tagIds);
  }
  return filters;
}

/** @deprecated Usar DocumentTags; se mantiene por compatibilidad temporal */
export function parseTagsInput(raw: unknown): string | null {
  if (raw === undefined || raw === null || raw === '') return null;

  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    if (trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed) as unknown;
        if (!Array.isArray(parsed)) throw badRequest('Tags debe ser un arreglo JSON');
        const tags = parsed.map((t) => String(t).trim()).filter(Boolean);
        return JSON.stringify(tags);
      } catch {
        throw badRequest('Formato de tags JSON inválido');
      }
    }
    const tags = trimmed
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    return tags.length > 0 ? JSON.stringify(tags) : null;
  }

  if (Array.isArray(raw)) {
    const tags = raw.map((t) => String(t).trim()).filter(Boolean);
    return tags.length > 0 ? JSON.stringify(tags) : null;
  }

  throw badRequest('Tags inválidos');
}

export function validateUploadDocumentFields(body: Record<string, unknown>): {
  folderId: number;
  name: string;
  description: string | null;
  tagIds: number[];
} {
  const folderId = requireId(body.folderId, 'Carpeta destino');
  const name = requireString(body.name, 'Nombre del documento', 2, 255);
  const description = optionalString(body.description, 1000);
  const tagIds = parseTagIdsInput(body.tagIds);
  return { folderId, name, description, tagIds };
}

export function validateRejectDocumentBody(body: Record<string, unknown>): {
  reason: string | null;
} {
  return { reason: optionalString(body.reason, 500) };
}

export { parseIdParam } from './collaborator.validator';
