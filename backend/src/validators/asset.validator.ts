import type { AppError } from '../middlewares/error.middleware';
import { ASSET_CONDITIONS, type AssetCondition } from '../constants/asset-condition';
import { ASSET_STATUSES, type AssetStatus } from '../constants/asset-status';
import { MAINTENANCE_TYPES } from '../constants/maintenance-type';

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
  if (t.length > max) throw badRequest('Texto demasiado largo');
  return t || null;
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

function parseEnum<T extends string>(v: unknown, allowed: readonly T[], label: string): T {
  if (typeof v !== 'string' || !allowed.includes(v as T)) throw badRequest(`${label} inválido`);
  return v as T;
}

function optDate(v: unknown): Date | null {
  if (v == null || v === '') return null;
  if (typeof v !== 'string') throw badRequest('Fecha inválida');
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) throw badRequest('Fecha inválida');
  return d;
}

function optDecimal(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = typeof v === 'string' ? Number.parseFloat(v) : v;
  if (typeof n !== 'number' || Number.isNaN(n) || n < 0) throw badRequest('Monto inválido');
  return n;
}

export function validateCreateAssetBody(body: Record<string, unknown>) {
  const serial = optString(body.serial, 100);
  return {
    serial,
    sku: optString(body.sku, 100),
    name: requireString(body.name, 'Nombre', 300),
    brand: optString(body.brand, 100),
    model: optString(body.model, 100),
    description: optString(body.description, 50_000),
    categoryId: parseId(body.categoryId, 'Categoría'),
    status:
      body.status != null
        ? parseEnum(body.status, ASSET_STATUSES, 'Estado')
        : ('ACTIVE' as AssetStatus),
    condition:
      body.condition != null
        ? parseEnum(body.condition, ASSET_CONDITIONS, 'Condición')
        : ('GOOD' as AssetCondition),
    purchaseDate: optDate(body.purchaseDate),
    warrantyExpiry: optDate(body.warrantyExpiry),
    purchasePrice: optDecimal(body.purchasePrice),
    location: optString(body.location, 200),
    notes: optString(body.notes, 50_000),
  };
}

export function validateUpdateAssetBody(body: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  if (body.serial !== undefined) out.serial = optString(body.serial, 100);
  if (body.sku !== undefined) out.sku = optString(body.sku, 100);
  if (body.name !== undefined) out.name = requireString(body.name, 'Nombre', 300);
  if (body.brand !== undefined) out.brand = optString(body.brand, 100);
  if (body.model !== undefined) out.model = optString(body.model, 100);
  if (body.description !== undefined) out.description = optString(body.description, 50_000);
  if (body.categoryId !== undefined) out.categoryId = parseId(body.categoryId, 'Categoría');
  if (body.status !== undefined) out.status = parseEnum(body.status, ASSET_STATUSES, 'Estado');
  if (body.condition !== undefined)
    out.condition = parseEnum(body.condition, ASSET_CONDITIONS, 'Condición');
  if (body.purchaseDate !== undefined) out.purchaseDate = optDate(body.purchaseDate);
  if (body.warrantyExpiry !== undefined) out.warrantyExpiry = optDate(body.warrantyExpiry);
  if (body.purchasePrice !== undefined) out.purchasePrice = optDecimal(body.purchasePrice);
  if (body.location !== undefined) out.location = optString(body.location, 200);
  if (body.notes !== undefined) out.notes = optString(body.notes, 50_000);
  return out;
}

export function validateAssignAssetBody(body: Record<string, unknown>) {
  return {
    userId: parseId(body.userId, 'Usuario'),
    notes: optString(body.notes, 500),
  };
}

export function validateAssetStatusBody(body: Record<string, unknown>) {
  return { status: parseEnum(body.status, ASSET_STATUSES, 'Estado') };
}

export function validateMaintenanceBody(body: Record<string, unknown>) {
  return {
    type: parseEnum(body.type, MAINTENANCE_TYPES, 'Tipo'),
    description: requireString(body.description, 'Descripción', 50_000),
    cost: optDecimal(body.cost),
    performedAt: body.performedAt != null ? (optDate(body.performedAt) ?? new Date()) : new Date(),
    nextMaintenanceAt: optDate(body.nextMaintenanceAt),
    relatedTicketId:
      body.relatedTicketId != null && body.relatedTicketId !== ''
        ? parseId(body.relatedTicketId, 'Ticket')
        : null,
  };
}

function optDateOnly(v: unknown, label: string): string | undefined {
  if (v == null || v === '') return undefined;
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v.trim())) {
    throw badRequest(`${label} inválida`);
  }
  return v.trim();
}

function dateRangeStart(isoDate: string): Date {
  return new Date(`${isoDate}T00:00:00.000Z`);
}

function dateRangeEnd(isoDate: string): Date {
  return new Date(`${isoDate}T23:59:59.999Z`);
}

export function parseAssetListQuery(q: Record<string, unknown>) {
  const createdFrom = optDateOnly(q.createdFrom, 'Fecha de alta desde');
  const createdTo = optDateOnly(q.createdTo, 'Fecha de alta hasta');
  const assignedFrom = optDateOnly(q.assignedFrom, 'Fecha de asignación desde');
  const assignedUntil = optDateOnly(q.assignedUntil, 'Fecha de asignación hasta');

  return {
    categoryId: optId(q.categoryId),
    status:
      q.status != null && q.status !== ''
        ? parseEnum(q.status, ASSET_STATUSES, 'Estado')
        : undefined,
    assignedTo: optId(q.assignedTo),
    unassignedOnly: q.unassignedOnly === 'true' || q.unassignedOnly === true,
    search: typeof q.search === 'string' ? q.search.trim() || undefined : undefined,
    purchaseDateFrom: optDateOnly(q.purchaseDateFrom, 'Fecha de compra desde'),
    purchaseDateTo: optDateOnly(q.purchaseDateTo, 'Fecha de compra hasta'),
    createdFrom: createdFrom ? dateRangeStart(createdFrom) : undefined,
    createdTo: createdTo ? dateRangeEnd(createdTo) : undefined,
    assignedFrom: assignedFrom ? dateRangeStart(assignedFrom) : undefined,
    assignedToDate: assignedUntil ? dateRangeEnd(assignedUntil) : undefined,
  };
}
