import type { AppError } from '../middlewares/error.middleware';
import type { DirectoryListFilters } from '../repositories/directory.repository';

function badRequest(message: string): AppError {
  const error = new Error(message) as AppError;
  error.statusCode = 400;
  return error;
}

function parseOptionalId(value: unknown, field: string): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const raw = typeof value === 'string' ? value : String(value);
  const num = Number.parseInt(raw, 10);
  if (!Number.isInteger(num) || num <= 0) {
    throw badRequest(`${field} inválido`);
  }
  return num;
}

export function parseDirectoryQuery(query: Record<string, unknown>): DirectoryListFilters {
  const name =
    typeof query.name === 'string'
      ? query.name
      : typeof query.nombre === 'string'
        ? query.nombre
        : undefined;

  const areaId = parseOptionalId(query.areaId, 'areaId') ?? parseOptionalId(query.idArea, 'idArea');

  const positionId =
    parseOptionalId(query.positionId, 'positionId') ?? parseOptionalId(query.idCargo, 'idCargo');

  return {
    name: name?.trim() || undefined,
    areaId,
    positionId,
  };
}
