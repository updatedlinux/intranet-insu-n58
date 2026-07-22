import type { AppError } from '../middlewares/error.middleware';
import {
  countTicketsByCategoryId,
  createTicketCategory,
  deleteTicketCategory,
  findTicketCategoryById,
  listTicketCategories,
  setTicketCategoryActive,
  ticketCategoryNameExists,
  updateTicketCategory,
  type TicketCategoryListFilters,
  type TicketCategoryRow,
} from '../repositories/ticket-category.repository';

export interface PublicTicketCategory {
  id: number;
  name: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  ticketCount: number;
}

function notFound(message = 'Categoría no encontrada'): AppError {
  const error = new Error(message) as AppError;
  error.statusCode = 404;
  return error;
}

function conflict(message: string): AppError {
  const error = new Error(message) as AppError;
  error.statusCode = 409;
  return error;
}

async function toPublic(row: TicketCategoryRow): Promise<PublicTicketCategory> {
  const ticketCount = await countTicketsByCategoryId(row.id);
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    sortOrder: row.sortOrder,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    ticketCount,
  };
}

export async function listTicketCategoriesService(
  filters: TicketCategoryListFilters,
): Promise<{ items: PublicTicketCategory[] }> {
  const rows = await listTicketCategories(filters);
  const items = await Promise.all(rows.map(toPublic));
  return { items };
}

export async function getTicketCategoryService(id: number): Promise<PublicTicketCategory> {
  const row = await findTicketCategoryById(id);
  if (!row) throw notFound();
  return toPublic(row);
}

export async function createTicketCategoryService(data: {
  name: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
}): Promise<PublicTicketCategory> {
  if (await ticketCategoryNameExists(data.name)) {
    throw conflict('Ya existe una categoría con ese nombre');
  }
  const id = await createTicketCategory(data);
  return getTicketCategoryService(id);
}

export async function updateTicketCategoryService(
  id: number,
  data: {
    name: string;
    description: string | null;
    sortOrder: number;
    isActive: boolean;
  },
): Promise<PublicTicketCategory> {
  const existing = await findTicketCategoryById(id);
  if (!existing) throw notFound();

  if (await ticketCategoryNameExists(data.name, id)) {
    throw conflict('Ya existe una categoría con ese nombre');
  }

  if (!data.isActive && existing.isActive) {
    const ticketCount = await countTicketsByCategoryId(id);
    if (ticketCount > 0) {
      throw conflict(
        'No se puede desactivar: hay tickets asociados. Deje la categoría activa o cree otra.',
      );
    }
  }

  await updateTicketCategory(id, data);
  return getTicketCategoryService(id);
}

export async function toggleTicketCategoryService(
  id: number,
  isActive: boolean,
): Promise<PublicTicketCategory> {
  const existing = await findTicketCategoryById(id);
  if (!existing) throw notFound();

  if (!isActive) {
    const ticketCount = await countTicketsByCategoryId(id);
    if (ticketCount > 0) {
      throw conflict('No se puede desactivar: hay tickets asociados a esta categoría');
    }
  }

  await setTicketCategoryActive(id, isActive);
  return getTicketCategoryService(id);
}

export async function deleteTicketCategoryService(id: number): Promise<void> {
  const existing = await findTicketCategoryById(id);
  if (!existing) throw notFound();
  const ticketCount = await countTicketsByCategoryId(id);
  if (ticketCount > 0) {
    throw conflict(
      `No se puede eliminar: hay ${ticketCount} ticket${ticketCount === 1 ? '' : 's'} asociado${ticketCount === 1 ? '' : 's'}`,
    );
  }
  await deleteTicketCategory(id);
}
