import type { AppError } from '../middlewares/error.middleware';
import { TASK_STATUS, type TaskStatus } from '../constants/task-status';

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

function parseOptionalHexColor(value: unknown): string | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') throw badRequest('Color inválido');
  const trimmed = value.trim();
  if (!/^#[0-9A-Fa-f]{6}$/.test(trimmed)) throw badRequest('Color debe ser HEX (#RRGGBB)');
  return trimmed;
}

export function validateCreateColumnBody(body: Record<string, unknown>) {
  return {
    name: requireString(body.name, 'Nombre', 100),
    color: parseOptionalHexColor(body.color),
    defaultStatus: parseDefaultStatus(body.defaultStatus),
  };
}

export function validateUpdateColumnBody(body: Record<string, unknown>) {
  const result: { name?: string; color?: string | null } = {};
  if (body.name !== undefined) result.name = requireString(body.name, 'Nombre', 100);
  if (body.color !== undefined) result.color = parseOptionalHexColor(body.color);
  if (Object.keys(result).length === 0) throw badRequest('No hay campos para actualizar');
  return result;
}

function parseDefaultStatus(value: unknown): TaskStatus {
  const statuses = new Set<string>(Object.values(TASK_STATUS));
  if (typeof value !== 'string' || !statuses.has(value) || value === TASK_STATUS.ARCHIVED) {
    throw badRequest('Estado por defecto inválido');
  }
  return value as TaskStatus;
}

export function validateReorderColumnsBody(body: Record<string, unknown>) {
  const columns = body.columns;
  if (!Array.isArray(columns) || columns.length === 0) {
    throw badRequest('columns es obligatorio');
  }
  return {
    columns: columns.map((item, index) => {
      if (typeof item !== 'object' || item == null) {
        throw badRequest(`columns[${index}] inválido`);
      }
      const row = item as Record<string, unknown>;
      return {
        columnId: parsePositiveInt(row.columnId, 'columnId'),
        order:
          typeof row.order === 'number' && Number.isInteger(row.order) && row.order >= 0
            ? row.order
            : (() => {
                throw badRequest('order inválido');
              })(),
      };
    }),
  };
}

export function parseBoardIdParam(value: string): number {
  return parsePositiveInt(value, 'boardId');
}

export function parseColumnIdParam(value: string): number {
  return parsePositiveInt(value, 'columnId');
}
