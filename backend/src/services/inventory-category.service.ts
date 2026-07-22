import type { AppError } from '../middlewares/error.middleware';
import {
  assetCategoryNameExists,
  consumableCategoryNameExists,
  createAssetCategory,
  createConsumableCategory,
  deleteAssetCategory,
  deleteConsumableCategory,
  findAssetCategoryById,
  findConsumableCategoryById,
  listAssetCategoriesAdmin,
  listConsumableCategoriesAdmin,
  updateAssetCategory,
  updateConsumableCategory,
} from '../repositories/inventory-category.repository';

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

function toPublicAssetCategory(row: Awaited<ReturnType<typeof findAssetCategoryById>> & object) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    itemCount: row.itemCount,
    createdAt: row.createdAt.toISOString(),
  };
}

function toPublicConsumableCategory(
  row: Awaited<ReturnType<typeof findConsumableCategoryById>> & object,
) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    itemCount: row.itemCount,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listAssetCategoriesAdminService(filters: { name?: string }) {
  const rows = await listAssetCategoriesAdmin(filters.name);
  return {
    items: rows.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      itemCount: r.itemCount,
      createdAt: r.createdAt.toISOString(),
    })),
  };
}

export async function getAssetCategoryService(id: number) {
  const row = await findAssetCategoryById(id);
  if (!row) throw notFound('Categoría no encontrada');
  return { item: toPublicAssetCategory(row) };
}

export async function createAssetCategoryService(
  input: ReturnType<
    typeof import('../validators/inventory-category.validator').validateAssetCategoryBody
  >,
) {
  if (await assetCategoryNameExists(input.name)) {
    throw badRequest('Ya existe una categoría con ese nombre');
  }
  const id = await createAssetCategory(input);
  const row = await findAssetCategoryById(id);
  return { item: toPublicAssetCategory(row!) };
}

export async function updateAssetCategoryService(
  id: number,
  input: ReturnType<
    typeof import('../validators/inventory-category.validator').validateAssetCategoryBody
  >,
) {
  const row = await findAssetCategoryById(id);
  if (!row) throw notFound('Categoría no encontrada');
  if (await assetCategoryNameExists(input.name, id)) {
    throw badRequest('Ya existe una categoría con ese nombre');
  }
  await updateAssetCategory(id, input);
  const updated = await findAssetCategoryById(id);
  return { item: toPublicAssetCategory(updated!) };
}

export async function deleteAssetCategoryService(id: number): Promise<void> {
  const row = await findAssetCategoryById(id);
  if (!row) throw notFound('Categoría no encontrada');
  if (row.itemCount > 0) {
    throw badRequest(`No se puede eliminar: hay ${row.itemCount} activo(s) en esta categoría`);
  }
  await deleteAssetCategory(id);
}

export async function listConsumableCategoriesAdminService(filters: { name?: string }) {
  const rows = await listConsumableCategoriesAdmin(filters.name);
  return {
    items: rows.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      itemCount: r.itemCount,
      createdAt: r.createdAt.toISOString(),
    })),
  };
}

export async function getConsumableCategoryService(id: number) {
  const row = await findConsumableCategoryById(id);
  if (!row) throw notFound('Categoría no encontrada');
  return { item: toPublicConsumableCategory(row) };
}

export async function createConsumableCategoryService(
  input: ReturnType<
    typeof import('../validators/inventory-category.validator').validateConsumableCategoryBody
  >,
) {
  if (await consumableCategoryNameExists(input.name)) {
    throw badRequest('Ya existe una categoría con ese nombre');
  }
  const id = await createConsumableCategory(input);
  const row = await findConsumableCategoryById(id);
  return { item: toPublicConsumableCategory(row!) };
}

export async function updateConsumableCategoryService(
  id: number,
  input: ReturnType<
    typeof import('../validators/inventory-category.validator').validateConsumableCategoryBody
  >,
) {
  const row = await findConsumableCategoryById(id);
  if (!row) throw notFound('Categoría no encontrada');
  if (await consumableCategoryNameExists(input.name, id)) {
    throw badRequest('Ya existe una categoría con ese nombre');
  }
  await updateConsumableCategory(id, input);
  const updated = await findConsumableCategoryById(id);
  return { item: toPublicConsumableCategory(updated!) };
}

export async function deleteConsumableCategoryService(id: number): Promise<void> {
  const row = await findConsumableCategoryById(id);
  if (!row) throw notFound('Categoría no encontrada');
  if (row.itemCount > 0) {
    throw badRequest(`No se puede eliminar: hay ${row.itemCount} consumible(s) en esta categoría`);
  }
  await deleteConsumableCategory(id);
}
