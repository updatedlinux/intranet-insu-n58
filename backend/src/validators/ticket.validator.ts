import type { AppError } from '../middlewares/error.middleware';
import { TICKET_PRIORITY, type TicketPriority } from '../constants/ticket-priority';
import { TICKET_STATUS, type TicketStatus } from '../constants/ticket-status';

function badRequest(message: string): AppError {
  const error = new Error(message) as AppError;
  error.statusCode = 400;
  return error;
}

const PRIORITIES = new Set<string>(Object.values(TICKET_PRIORITY));
const STATUSES = new Set<string>(Object.values(TICKET_STATUS));

function requireString(value: unknown, field: string, maxLen: number): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw badRequest(`${field} es obligatorio`);
  }
  const trimmed = value.trim();
  if (trimmed.length > maxLen) throw badRequest(`${field} demasiado largo`);
  return trimmed;
}

function requireCategoryId(value: unknown): number {
  const num = typeof value === 'string' ? Number.parseInt(value, 10) : value;
  if (typeof num !== 'number' || !Number.isInteger(num) || num <= 0) {
    throw badRequest('Categoría inválida');
  }
  return num;
}

export function validateCreateTicketBody(body: Record<string, unknown>) {
  return {
    title: requireString(body.title, 'Título', 255),
    description: requireString(body.description, 'Descripción', 50_000),
    categoryId: requireCategoryId(body.categoryId),
    priority: parsePriority(body.priority),
  };
}

export function parsePriority(value: unknown): TicketPriority {
  if (typeof value !== 'string' || !PRIORITIES.has(value)) {
    throw badRequest('Prioridad inválida');
  }
  return value as TicketPriority;
}

export function parseStatus(value: unknown): TicketStatus {
  if (typeof value !== 'string' || !STATUSES.has(value)) {
    throw badRequest('Estado inválido');
  }
  return value as TicketStatus;
}

export function validateAssignTicketBody(body: Record<string, unknown>) {
  if (body.assignedTo === undefined || body.assignedTo === null) {
    return { assignedTo: null as number | null, selfAssign: true };
  }
  const num =
    typeof body.assignedTo === 'string' ? Number.parseInt(body.assignedTo, 10) : body.assignedTo;
  if (typeof num !== 'number' || !Number.isInteger(num) || num <= 0) {
    throw badRequest('assignedTo inválido');
  }
  return { assignedTo: num, selfAssign: false };
}

export function validateStatusBody(body: Record<string, unknown>) {
  return { status: parseStatus(body.status) };
}

export function validatePriorityBody(body: Record<string, unknown>) {
  return { priority: parsePriority(body.priority) };
}

export function validateCommentBody(body: Record<string, unknown>) {
  return { message: requireString(body.message, 'Mensaje', 10_000) };
}

export function parseTicketListQuery(query: Record<string, unknown>) {
  const categoryIdRaw = query.categoryId;
  let categoryId: number | undefined;
  if (categoryIdRaw != null && categoryIdRaw !== '') {
    categoryId = requireCategoryId(categoryIdRaw);
  }

  return {
    status: query.status ? parseStatus(query.status) : undefined,
    priority: query.priority ? parsePriority(query.priority) : undefined,
    categoryId,
    requesterId:
      query.requesterId != null && query.requesterId !== ''
        ? Number.parseInt(String(query.requesterId), 10)
        : undefined,
    search: typeof query.search === 'string' ? query.search : undefined,
    activeOnly: query.activeOnly === 'true' || query.activeOnly === '1',
    mineOnly: query.mineOnly === 'true' || query.mineOnly === '1',
  };
}
