import type { AppError } from '../middlewares/error.middleware';
import {
  applyStockMovement,
  createConsumable,
  findConsumableById,
  listConsumableCategories,
  listConsumables,
  listStockMovements,
  skuExists,
  updateConsumable,
  type ConsumableRow,
} from '../repositories/consumable.repository';
import type { AuthenticatedUser } from '../types/auth';
import { resolvePublicConsumablePhotoUrl } from '../utils/consumable-photo-url';

function notFound(msg: string): AppError {
  const e = new Error(msg) as AppError;
  e.statusCode = 404;
  return e;
}

function badRequest(msg: string): AppError {
  const e = new Error(msg) as AppError;
  e.statusCode = 400;
  return e;
}

function toPublicConsumable(row: ConsumableRow) {
  return {
    id: row.id,
    sku: row.sku,
    name: row.name,
    brand: row.brand,
    model: row.model,
    description: row.description,
    categoryId: row.categoryId,
    categoryName: row.categoryName,
    unit: row.unit,
    currentStock: row.currentStock,
    minimumStock: row.minimumStock,
    isLowStock: row.currentStock <= row.minimumStock,
    location: row.location,
    photoUrl: resolvePublicConsumablePhotoUrl(row.id, row.imageKey),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toPublicMovement(m: Awaited<ReturnType<typeof listStockMovements>>[0]) {
  return {
    id: m.id,
    consumableId: m.consumableId,
    consumableName: m.consumableName,
    consumableSku: m.consumableSku,
    type: m.type,
    quantity: m.quantity,
    previousStock: m.previousStock,
    newStock: m.newStock,
    reason: m.reason,
    relatedTicketId: m.relatedTicketId,
    relatedTicketCode: m.relatedTicketCode,
    performerName: `${m.performerFirstName} ${m.performerLastName}`.trim(),
    createdAt: m.createdAt.toISOString(),
  };
}

export async function listConsumableCategoriesService() {
  return { items: await listConsumableCategories() };
}

export async function createConsumableService(
  user: AuthenticatedUser,
  input: ReturnType<
    typeof import('../validators/consumable.validator').validateCreateConsumableBody
  >,
) {
  if (await skuExists(input.sku)) throw badRequest('El SKU ya existe');
  const id = await createConsumable({ ...input, createdBy: user.id });
  const row = await findConsumableById(id);
  return { item: toPublicConsumable(row!) };
}

export async function listConsumablesService(filters: Parameters<typeof listConsumables>[0]) {
  const rows = await listConsumables(filters);
  return { items: rows.map(toPublicConsumable) };
}

export async function getConsumableDetailService(id: number) {
  const row = await findConsumableById(id);
  if (!row) throw notFound('Consumible no encontrado');
  const movements = await listStockMovements(id);
  return {
    item: toPublicConsumable(row),
    movements: movements.map(toPublicMovement),
  };
}

export async function updateConsumableService(id: number, fields: Record<string, unknown>) {
  const row = await findConsumableById(id);
  if (!row) throw notFound('Consumible no encontrado');
  if (fields.sku && typeof fields.sku === 'string' && (await skuExists(fields.sku, id))) {
    throw badRequest('El SKU ya existe');
  }
  await updateConsumable(id, fields);
  return getConsumableDetailService(id);
}

export async function stockInService(
  user: AuthenticatedUser,
  id: number,
  input: { quantity: number; reason: string | null; relatedTicketId: number | null },
) {
  const row = await findConsumableById(id);
  if (!row) throw notFound('Consumible no encontrado');
  const newStock = row.currentStock + input.quantity;
  await applyStockMovement({
    consumableId: id,
    type: 'IN',
    quantity: input.quantity,
    previousStock: row.currentStock,
    newStock,
    reason: input.reason,
    relatedTicketId: input.relatedTicketId,
    performedBy: user.id,
  });
  return getConsumableDetailService(id);
}

export async function stockOutService(
  user: AuthenticatedUser,
  id: number,
  input: { quantity: number; reason: string | null; relatedTicketId: number | null },
) {
  const row = await findConsumableById(id);
  if (!row) throw notFound('Consumible no encontrado');
  if (row.currentStock < input.quantity) {
    throw badRequest(`Stock insuficiente (disponible: ${row.currentStock})`);
  }
  const newStock = row.currentStock - input.quantity;
  await applyStockMovement({
    consumableId: id,
    type: 'OUT',
    quantity: input.quantity,
    previousStock: row.currentStock,
    newStock,
    reason: input.reason,
    relatedTicketId: input.relatedTicketId,
    performedBy: user.id,
  });
  return getConsumableDetailService(id);
}

export async function stockAdjustService(
  user: AuthenticatedUser,
  id: number,
  input: { newStock: number; reason: string; relatedTicketId: number | null },
) {
  const row = await findConsumableById(id);
  if (!row) throw notFound('Consumible no encontrado');
  const delta = Math.abs(input.newStock - row.currentStock);
  await applyStockMovement({
    consumableId: id,
    type: 'ADJUSTMENT',
    quantity: delta,
    previousStock: row.currentStock,
    newStock: input.newStock,
    reason: input.reason,
    relatedTicketId: input.relatedTicketId,
    performedBy: user.id,
  });
  return getConsumableDetailService(id);
}

export async function listTicketConsumableUsageService(ticketId: number) {
  const movements = await listStockMovements(undefined, { ticketId });
  return { items: movements.filter((m) => m.type === 'OUT').map(toPublicMovement) };
}
