import type { AppError } from '../middlewares/error.middleware';

function badRequest(message: string): AppError {
  const error = new Error(message) as AppError;
  error.statusCode = 400;
  return error;
}

function requireId(value: unknown, field: string): number {
  const num = typeof value === 'string' ? Number.parseInt(value, 10) : value;
  if (typeof num !== 'number' || !Number.isInteger(num) || num <= 0) {
    throw badRequest(`${field} inválido`);
  }
  return num;
}

function requireBool(value: unknown, field: string): boolean {
  if (typeof value !== 'boolean') throw badRequest(`${field} inválido`);
  return value;
}

export function validateChatAreaAccessBody(body: Record<string, unknown>) {
  const notes =
    body.notes == null || body.notes === ''
      ? null
      : typeof body.notes === 'string'
        ? body.notes.trim().slice(0, 500)
        : (() => {
            throw badRequest('Notas inválidas');
          })();

  return {
    userId: requireId(body.userId, 'Colaborador'),
    areaId: requireId(body.areaId, 'Área del chat grupal'),
    notes,
    isActive: body.isActive === undefined ? true : requireBool(body.isActive, 'isActive'),
  };
}
