import type { AppError } from '../middlewares/error.middleware';
import { findUserById } from '../repositories/user.repository';
import {
  allocateAssetCode,
  closeOpenAssignment,
  createAsset,
  createMaintenance,
  findAssetById,
  listAssets,
  listAssetsByUserId,
  listAssignmentHistory,
  listAssetCategories,
  listMaintenanceLogs,
  openAssignment,
  serialExists,
  updateAsset,
  type AssetRow,
} from '../repositories/asset.repository';
import type { AuthenticatedUser } from '../types/auth';
import { resolvePublicAssetPhotoUrl } from '../utils/asset-photo-url';

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

function displayName(first: string, last: string): string {
  return `${first} ${last}`.trim();
}

function toPublicAsset(row: AssetRow) {
  return {
    id: row.id,
    code: row.code,
    serial: row.serial,
    sku: row.sku,
    name: row.name,
    brand: row.brand,
    model: row.model,
    description: row.description,
    categoryId: row.categoryId,
    categoryName: row.categoryName,
    status: row.status,
    condition: row.condition,
    purchaseDate: row.purchaseDate?.toISOString().slice(0, 10) ?? null,
    warrantyExpiry: row.warrantyExpiry?.toISOString().slice(0, 10) ?? null,
    purchasePrice: row.purchasePrice,
    location: row.location,
    assignedTo: row.assignedTo,
    assigneeName: row.assigneeFirstName
      ? displayName(row.assigneeFirstName, row.assigneeLastName!)
      : null,
    assignedAt: row.assignedAt?.toISOString() ?? null,
    notes: row.notes,
    photoUrl: resolvePublicAssetPhotoUrl(row.id, row.imageKey),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listAssetCategoriesService() {
  return { items: await listAssetCategories() };
}

export async function createAssetService(
  user: AuthenticatedUser,
  input: ReturnType<typeof import('../validators/asset.validator').validateCreateAssetBody>,
) {
  if (input.serial && (await serialExists(input.serial))) {
    throw badRequest('El serial ya está registrado');
  }
  const code = await allocateAssetCode();
  const id = await createAsset({
    ...input,
    code,
    createdBy: user.id,
  });
  const row = await findAssetById(id);
  if (!row) throw notFound('Activo no encontrado');
  return { item: toPublicAsset(row) };
}

export async function listAssetsService(filters: Parameters<typeof listAssets>[0]) {
  const rows = await listAssets(filters);
  return { items: rows.map(toPublicAsset) };
}

export async function getAssetDetailService(id: number) {
  const row = await findAssetById(id);
  if (!row) throw notFound('Activo no encontrado');
  const [assignments, maintenance] = await Promise.all([
    listAssignmentHistory(id),
    listMaintenanceLogs(id),
  ]);
  return {
    item: toPublicAsset(row),
    assignments: assignments.map((a) => ({
      id: a.id,
      userId: a.userId,
      userName: displayName(a.userFirstName, a.userLastName),
      assignedByName: displayName(a.assignerFirstName, a.assignerLastName),
      assignedAt: a.assignedAt.toISOString(),
      returnedAt: a.returnedAt?.toISOString() ?? null,
      notes: a.notes,
    })),
    maintenance: maintenance.map((m) => ({
      id: m.id,
      type: m.type,
      description: m.description,
      cost: m.cost,
      performedAt: m.performedAt.toISOString(),
      nextMaintenanceAt: m.nextMaintenanceAt?.toISOString() ?? null,
      relatedTicketId: m.relatedTicketId,
      relatedTicketCode: m.relatedTicketCode,
      performerName: displayName(m.performerFirstName, m.performerLastName),
    })),
  };
}

export async function updateAssetService(id: number, fields: Record<string, unknown>) {
  const row = await findAssetById(id);
  if (!row) throw notFound('Activo no encontrado');
  if (
    fields.serial &&
    typeof fields.serial === 'string' &&
    (await serialExists(fields.serial, id))
  ) {
    throw badRequest('El serial ya está registrado');
  }
  await updateAsset(id, fields);
  const updated = await findAssetById(id);
  return { item: toPublicAsset(updated!) };
}

export async function assignAssetService(
  user: AuthenticatedUser,
  id: number,
  input: { userId: number; notes: string | null },
) {
  const row = await findAssetById(id);
  if (!row) throw notFound('Activo no encontrado');
  const target = await findUserById(input.userId);
  if (!target?.isActive) throw badRequest('Usuario no válido');

  const now = new Date();
  if (row.assignedTo != null) {
    await closeOpenAssignment(id, now);
  }

  await openAssignment({
    assetId: id,
    userId: input.userId,
    assignedBy: user.id,
    notes: input.notes,
  });

  await updateAsset(id, {
    assignedTo: input.userId,
    assignedAt: now,
  });

  return getAssetDetailService(id);
}

export async function unassignAssetService(id: number) {
  const row = await findAssetById(id);
  if (!row) throw notFound('Activo no encontrado');
  if (row.assignedTo == null) throw badRequest('El activo no está asignado');

  const now = new Date();
  await closeOpenAssignment(id, now);
  await updateAsset(id, { assignedTo: null, assignedAt: null });
  return getAssetDetailService(id);
}

export async function updateAssetStatusService(
  id: number,
  status: import('../constants/asset-status').AssetStatus,
) {
  const row = await findAssetById(id);
  if (!row) throw notFound('Activo no encontrado');
  await updateAsset(id, { status });
  return getAssetDetailService(id);
}

export async function addMaintenanceService(
  user: AuthenticatedUser,
  id: number,
  input: {
    type: import('../constants/maintenance-type').MaintenanceType;
    description: string;
    cost: number | null;
    performedAt: Date;
    nextMaintenanceAt: Date | null;
    relatedTicketId: number | null;
  },
) {
  const row = await findAssetById(id);
  if (!row) throw notFound('Activo no encontrado');
  await createMaintenance({
    assetId: id,
    performedBy: user.id,
    ...input,
  });
  return getAssetDetailService(id);
}

export async function listUserAssetsService(userId: number) {
  const rows = await listAssetsByUserId(userId);
  return { items: rows.map(toPublicAsset) };
}
