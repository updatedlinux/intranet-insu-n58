import type { AppError } from '../middlewares/error.middleware';
import { TASK_PRIORITIES, type TaskPriority } from '../constants/task-priority';

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

function parsePositiveInt(value: unknown, field: string): number {
  const num = typeof value === 'string' ? Number.parseInt(value, 10) : value;
  if (typeof num !== 'number' || !Number.isInteger(num) || num <= 0) {
    throw badRequest(`${field} inválido`);
  }
  return num;
}

function parseOptionalString(value: unknown, maxLen: number): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') throw badRequest('Descripción inválida');
  const trimmed = value.trim();
  if (trimmed.length > maxLen) throw badRequest('Descripción demasiado larga');
  return trimmed || null;
}

function parseOptionalHexColor(value: unknown): string | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') throw badRequest('Color inválido');
  const trimmed = value.trim();
  if (!/^#[0-9A-Fa-f]{6}$/.test(trimmed)) throw badRequest('Color debe ser HEX (#RRGGBB)');
  return trimmed;
}

function parsePriority(value: unknown): TaskPriority {
  if (typeof value !== 'string' || !TASK_PRIORITIES.includes(value as TaskPriority)) {
    throw badRequest('Prioridad inválida');
  }
  return value as TaskPriority;
}

function parseOptionalDueDate(value: unknown): Date | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') throw badRequest('Fecha límite inválida');
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw badRequest('Fecha límite inválida');
  return date;
}

function parseIdArray(value: unknown, field: string): number[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw badRequest(`${field} debe ser un arreglo`);
  return value.map((item, i) => parsePositiveInt(item, `${field}[${i}]`));
}

export function validateCreateTaskBody(body: Record<string, unknown>) {
  return {
    boardId: parsePositiveInt(body.boardId, 'boardId'),
    columnId: parsePositiveInt(body.columnId, 'columnId'),
    title: requireString(body.title, 'Título', 300),
    description: parseOptionalString(body.description, 50_000),
    priority: body.priority != null ? parsePriority(body.priority) : ('Medium' as TaskPriority),
    color: parseOptionalHexColor(body.color),
    dueDate: parseOptionalDueDate(body.dueDate),
    assigneeIds: parseIdArray(body.assigneeIds, 'assigneeIds'),
    tagIds: parseIdArray(body.tagIds, 'tagIds'),
  };
}

export function validateUpdateTaskBody(body: Record<string, unknown>) {
  const result: {
    title?: string;
    description?: string | null;
    priority?: TaskPriority;
    color?: string | null;
    dueDate?: Date | null;
    tagIds?: number[];
  } = {};

  if (body.title !== undefined) result.title = requireString(body.title, 'Título', 300);
  if (body.description !== undefined)
    result.description = parseOptionalString(body.description, 50_000);
  if (body.priority !== undefined) result.priority = parsePriority(body.priority);
  if (body.color !== undefined) result.color = parseOptionalHexColor(body.color);
  if (body.dueDate !== undefined) result.dueDate = parseOptionalDueDate(body.dueDate);
  if (body.tagIds !== undefined) result.tagIds = parseIdArray(body.tagIds, 'tagIds');

  if (Object.keys(result).length === 0) throw badRequest('No hay campos para actualizar');
  return result;
}

export function validateMoveTaskBody(body: Record<string, unknown>) {
  const result: {
    columnId: number;
    order: number;
    taskOrders?: { taskId: number; order: number }[];
  } = {
    columnId: parsePositiveInt(body.columnId, 'columnId'),
    order:
      typeof body.order === 'number' && Number.isInteger(body.order) && body.order >= 0
        ? body.order
        : (() => {
            throw badRequest('order inválido');
          })(),
  };

  if (body.taskOrders !== undefined) {
    if (!Array.isArray(body.taskOrders)) throw badRequest('taskOrders inválido');
    result.taskOrders = body.taskOrders.map((item, index) => {
      if (typeof item !== 'object' || item == null)
        throw badRequest(`taskOrders[${index}] inválido`);
      const row = item as Record<string, unknown>;
      return {
        taskId: parsePositiveInt(row.taskId, 'taskId'),
        order:
          typeof row.order === 'number' && Number.isInteger(row.order) && row.order >= 0
            ? row.order
            : (() => {
                throw badRequest('order inválido');
              })(),
      };
    });
  }

  return result;
}

export function validateAssignTaskBody(body: Record<string, unknown>) {
  const addIds = parseIdArray(body.addIds, 'addIds');
  const removeIds = parseIdArray(body.removeIds, 'removeIds');
  if (addIds.length === 0 && removeIds.length === 0) {
    throw badRequest('Debe indicar addIds o removeIds');
  }
  return { addIds, removeIds };
}

export function validateCommentBody(body: Record<string, unknown>) {
  return { message: requireString(body.message, 'Mensaje', 10_000) };
}

export function parseTaskIdParam(value: string): number {
  return parsePositiveInt(value, 'taskId');
}

export function parseAttachmentIdParam(value: string): number {
  return parsePositiveInt(value, 'attachmentId');
}
