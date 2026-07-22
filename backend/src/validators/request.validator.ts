import type { AppError } from '../middlewares/error.middleware';
import { REQUEST_PRIORITIES, type RequestPriority } from '../constants/request-priority';
import { REQUEST_STATUSES, type RequestStatus } from '../constants/request-status';

function badRequest(message: string): AppError {
  const error = new Error(message) as AppError;
  error.statusCode = 400;
  return error;
}

function requireString(value: unknown, field: string, maxLen: number): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw badRequest(`${field} es obligatorio`);
  }
  const trimmed = value.trim();
  if (trimmed.length > maxLen) throw badRequest(`${field} demasiado largo`);
  return trimmed;
}

function parseOptionalString(value: unknown, maxLen: number): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') throw badRequest('Texto inválido');
  const trimmed = value.trim();
  if (trimmed.length > maxLen) throw badRequest('Texto demasiado largo');
  return trimmed || null;
}

function parsePositiveInt(value: unknown, field: string): number {
  const num = typeof value === 'string' ? Number.parseInt(value, 10) : value;
  if (typeof num !== 'number' || !Number.isInteger(num) || num <= 0) {
    throw badRequest(`${field} inválido`);
  }
  return num;
}

function parseOptionalPositiveInt(value: unknown, field: string): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  return parsePositiveInt(value, field);
}

function parsePriority(value: unknown): RequestPriority {
  if (typeof value !== 'string' || !REQUEST_PRIORITIES.includes(value as RequestPriority)) {
    throw badRequest('Prioridad inválida');
  }
  return value as RequestPriority;
}

function parseStatus(value: unknown): RequestStatus {
  if (typeof value !== 'string' || !REQUEST_STATUSES.includes(value as RequestStatus)) {
    throw badRequest('Estado inválido');
  }
  return value as RequestStatus;
}

function parseOptionalStatus(value: unknown): RequestStatus | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  return parseStatus(value);
}

function parseOptionalDate(value: unknown, field: string): Date | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string' || !value.trim()) throw badRequest(`${field} inválido`);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw badRequest(`${field} inválido`);
  return date;
}

export function validateCreateRequestBody(body: Record<string, unknown>) {
  return {
    targetAreaId: parsePositiveInt(body.targetAreaId, 'Área destino'),
    title: requireString(body.title, 'Título', 300),
    description: requireString(body.description, 'Descripción', 50_000),
    category: parseOptionalString(body.category, 100),
    priority:
      body.priority !== undefined ? parsePriority(body.priority) : ('Medium' as RequestPriority),
  };
}

export function validateUpdateRequestStatusBody(body: Record<string, unknown>) {
  const status = parseStatus(body.status);
  const comment = parseOptionalString(body.comment, 500);
  const rejectionReason = parseOptionalString(body.rejectionReason, 500);
  if (status === 'REJECTED' && !rejectionReason) {
    throw badRequest('El motivo de rechazo es obligatorio');
  }
  return { status, comment, rejectionReason };
}

export function validateLinkTaskBody(body: Record<string, unknown>) {
  return {
    linkedTaskId: parsePositiveInt(body.linkedTaskId, 'Tarea'),
  };
}

export function parseRequestListQuery(query: Record<string, unknown>) {
  return {
    status: parseOptionalStatus(query.status),
    targetAreaId: parseOptionalPositiveInt(query.targetAreaId, 'targetAreaId'),
    priority:
      query.priority !== undefined && query.priority !== ''
        ? parsePriority(query.priority)
        : undefined,
    requesterId: parseOptionalPositiveInt(query.requesterId, 'requesterId'),
    fromDate: parseOptionalDate(query.from, 'from'),
    toDate: parseOptionalDate(query.to, 'to'),
  };
}
