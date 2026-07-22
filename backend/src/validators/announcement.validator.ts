import {
  ANNOUNCEMENT_CATEGORY,
  type AnnouncementCategory,
} from '../constants/announcement-category';
import { ANNOUNCEMENT_STATUS, type AnnouncementStatus } from '../constants/announcement-status';
import type { AppError } from '../middlewares/error.middleware';

function badRequest(message: string): AppError {
  const error = new Error(message) as AppError;
  error.statusCode = 400;
  return error;
}

function requireString(value: unknown, field: string, min: number, max: number): string {
  if (typeof value !== 'string') throw badRequest(`${field} inválido`);
  const trimmed = value.trim();
  if (trimmed.length < min || trimmed.length > max) {
    throw badRequest(`${field} debe tener entre ${min} y ${max} caracteres`);
  }
  return trimmed;
}

function optionalId(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const num = typeof value === 'number' ? value : Number.parseInt(String(value), 10);
  if (!Number.isInteger(num) || num <= 0) throw badRequest('Área destino inválida');
  return num;
}

const VALID_CATEGORIES = new Set<string>(Object.values(ANNOUNCEMENT_CATEGORY));

export function parseAnnouncementCategory(value: unknown): AnnouncementCategory {
  if (typeof value !== 'string' || !VALID_CATEGORIES.has(value)) {
    throw badRequest('Categoría inválida');
  }
  return value as AnnouncementCategory;
}

export function parseAnnouncementStatus(value: unknown): AnnouncementStatus | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (
    typeof value !== 'string' ||
    !Object.values(ANNOUNCEMENT_STATUS).includes(value as AnnouncementStatus)
  ) {
    throw badRequest('Estado inválido');
  }
  return value as AnnouncementStatus;
}

export function validateAnnouncementBody(body: Record<string, unknown>) {
  return {
    title: requireString(body.title, 'Título', 2, 255),
    content: requireString(body.content, 'Contenido', 1, 500_000),
    summary: requireString(body.summary, 'Resumen', 10, 300),
    imageUrl:
      body.imageUrl === null || body.imageUrl === undefined || body.imageUrl === ''
        ? null
        : requireString(body.imageUrl, 'Imagen', 1, 512),
    category: parseAnnouncementCategory(body.category),
    targetAreaId: optionalId(body.targetAreaId),
    publish: body.publish === true || body.publish === 'true',
  };
}

export function parseAnnouncementListQuery(query: Record<string, unknown>) {
  const search = typeof query.search === 'string' ? query.search.trim() : undefined;
  const category =
    typeof query.category === 'string' && query.category
      ? parseAnnouncementCategory(query.category)
      : undefined;
  const status = parseAnnouncementStatus(query.status);
  const limitRaw = query.limit;
  let limit: number | undefined;
  if (typeof limitRaw === 'string' && limitRaw) {
    limit = Number.parseInt(limitRaw, 10);
    if (!Number.isInteger(limit) || limit < 1 || limit > 20) {
      throw badRequest('limit inválido');
    }
  }
  return { search: search || undefined, category, status, limit };
}
