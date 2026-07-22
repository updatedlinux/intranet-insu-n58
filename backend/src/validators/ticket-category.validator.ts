import type { AppError } from '../middlewares/error.middleware';

function badRequest(message: string): AppError {
  const error = new Error(message) as AppError;
  error.statusCode = 400;
  return error;
}

export function validateTicketCategoryBody(body: Record<string, unknown>) {
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name || name.length > 100) {
    throw badRequest('El nombre es obligatorio (máx. 100 caracteres)');
  }

  const description =
    body.description == null || body.description === ''
      ? null
      : typeof body.description === 'string'
        ? body.description.trim().slice(0, 500)
        : null;

  const sortOrderRaw = body.sortOrder;
  const sortOrder =
    sortOrderRaw === undefined || sortOrderRaw === ''
      ? 0
      : typeof sortOrderRaw === 'number'
        ? sortOrderRaw
        : Number.parseInt(String(sortOrderRaw), 10);
  if (!Number.isInteger(sortOrder) || sortOrder < 0) {
    throw badRequest('Orden inválido');
  }

  const isActive = body.isActive === undefined ? true : Boolean(body.isActive);

  return { name, description, sortOrder, isActive };
}

export function parseTicketCategoryListQuery(query: Record<string, unknown>) {
  return {
    name: typeof query.name === 'string' ? query.name : undefined,
    isActive:
      query.isActive === 'true' || query.isActive === '1'
        ? true
        : query.isActive === 'false' || query.isActive === '0'
          ? false
          : undefined,
  };
}
