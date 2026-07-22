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

export function validateAreaAccessBody(body: Record<string, unknown>) {
  return {
    sourceAreaId: requireId(body.sourceAreaId, 'Área origen'),
    targetAreaId: requireId(body.targetAreaId, 'Área destino'),
    canRead: body.canRead === undefined ? false : requireBool(body.canRead, 'canRead'),
    canUpload: body.canUpload === undefined ? false : requireBool(body.canUpload, 'canUpload'),
    canApprove: body.canApprove === undefined ? false : requireBool(body.canApprove, 'canApprove'),
    canAnnounce:
      body.canAnnounce === undefined ? false : requireBool(body.canAnnounce, 'canAnnounce'),
    isActive: body.isActive === undefined ? true : requireBool(body.isActive, 'isActive'),
  };
}
