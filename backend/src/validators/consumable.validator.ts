import type { AppError } from '../middlewares/error.middleware';
import { CONSUMABLE_UNITS, type ConsumableUnit } from '../constants/consumable-unit';

function badRequest(message: string): AppError {
  const e = new Error(message) as AppError;
  e.statusCode = 400;
  return e;
}

function requireString(v: unknown, field: string, max: number): string {
  if (typeof v !== 'string' || !v.trim()) throw badRequest(`${field} es obligatorio`);
  const t = v.trim();
  if (t.length > max) throw badRequest(`${field} demasiado largo`);
  return t;
}

function optString(v: unknown, max: number): string | null {
  if (v == null || v === '') return null;
  if (typeof v !== 'string') throw badRequest('Texto inválido');
  const t = v.trim();
  return t.length > max
    ? (() => {
        throw badRequest('Texto demasiado largo');
      })()
    : t || null;
}

function parseId(v: unknown, field: string): number {
  const n = typeof v === 'string' ? Number.parseInt(v, 10) : v;
  if (typeof n !== 'number' || !Number.isInteger(n) || n <= 0)
    throw badRequest(`${field} inválido`);
  return n;
}

function optId(v: unknown): number | undefined {
  if (v == null || v === '') return undefined;
  return parseId(v, 'id');
}

function parsePositiveInt(v: unknown, field: string): number {
  const n = typeof v === 'string' ? Number.parseInt(v, 10) : v;
  if (typeof n !== 'number' || !Number.isInteger(n) || n <= 0)
    throw badRequest(`${field} inválido`);
  return n;
}

function parseNonNegativeInt(v: unknown, field: string): number {
  const n = typeof v === 'string' ? Number.parseInt(v, 10) : v;
  if (typeof n !== 'number' || !Number.isInteger(n) || n < 0) throw badRequest(`${field} inválido`);
  return n;
}

export function validateCreateConsumableBody(body: Record<string, unknown>) {
  return {
    sku: requireString(body.sku, 'SKU', 100),
    name: requireString(body.name, 'Nombre', 300),
    brand: optString(body.brand, 100),
    model: optString(body.model, 100),
    description: optString(body.description, 50_000),
    categoryId: parseId(body.categoryId, 'Categoría'),
    unit:
      body.unit != null && CONSUMABLE_UNITS.includes(body.unit as ConsumableUnit)
        ? (body.unit as ConsumableUnit)
        : 'UNIT',
    currentStock: body.currentStock != null ? parseNonNegativeInt(body.currentStock, 'Stock') : 0,
    minimumStock:
      body.minimumStock != null ? parseNonNegativeInt(body.minimumStock, 'Stock mínimo') : 0,
    location: optString(body.location, 200),
  };
}

export function validateUpdateConsumableBody(body: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  if (body.sku !== undefined) out.sku = requireString(body.sku, 'SKU', 100);
  if (body.name !== undefined) out.name = requireString(body.name, 'Nombre', 300);
  if (body.brand !== undefined) out.brand = optString(body.brand, 100);
  if (body.model !== undefined) out.model = optString(body.model, 100);
  if (body.description !== undefined) out.description = optString(body.description, 50_000);
  if (body.categoryId !== undefined) out.categoryId = parseId(body.categoryId, 'Categoría');
  if (body.unit !== undefined) {
    if (!CONSUMABLE_UNITS.includes(body.unit as ConsumableUnit))
      throw badRequest('Unidad inválida');
    out.unit = body.unit;
  }
  if (body.minimumStock !== undefined)
    out.minimumStock = parseNonNegativeInt(body.minimumStock, 'Stock mínimo');
  if (body.location !== undefined) out.location = optString(body.location, 200);
  return out;
}

export function validateStockInBody(body: Record<string, unknown>) {
  return {
    quantity: parsePositiveInt(body.quantity, 'Cantidad'),
    reason: optString(body.reason, 500),
    relatedTicketId:
      body.relatedTicketId != null && body.relatedTicketId !== ''
        ? parseId(body.relatedTicketId, 'Ticket')
        : null,
  };
}

export function validateStockOutBody(body: Record<string, unknown>) {
  return validateStockInBody(body);
}

export function validateStockAdjustBody(body: Record<string, unknown>) {
  const newStock = parseNonNegativeInt(body.newStock, 'Stock');
  const reason = optString(body.reason, 500);
  if (!reason) throw badRequest('La razón del ajuste es obligatoria');
  return {
    newStock,
    reason,
    relatedTicketId:
      body.relatedTicketId != null && body.relatedTicketId !== ''
        ? parseId(body.relatedTicketId, 'Ticket')
        : null,
  };
}

export function parseConsumableListQuery(q: Record<string, unknown>) {
  return {
    categoryId: optId(q.categoryId),
    lowStockOnly: q.lowStockOnly === 'true' || q.lowStockOnly === true,
    search: typeof q.search === 'string' ? q.search : undefined,
  };
}
