import type { AppError } from '../middlewares/error.middleware';
import {
  countDocumentLinksByTag,
  createTag,
  deleteTag,
  findTagById,
  listTags,
  setTagActive,
  tagNameExists,
  updateTag,
  type TagListFilters,
  type TagRow,
} from '../repositories/tag.repository';

export interface PublicTag {
  id: number;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  documentCount: number;
}

function notFound(message = 'Etiqueta no encontrada'): AppError {
  const error = new Error(message) as AppError;
  error.statusCode = 404;
  return error;
}

function conflict(message: string): AppError {
  const error = new Error(message) as AppError;
  error.statusCode = 409;
  return error;
}

async function toPublicTag(row: TagRow): Promise<PublicTag> {
  const documentCount = await countDocumentLinksByTag(row.id);
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    documentCount,
  };
}

export async function listTagsService(filters: TagListFilters): Promise<PublicTag[]> {
  const rows = await listTags(filters);
  return Promise.all(rows.map(toPublicTag));
}

export async function getTagService(id: number): Promise<PublicTag> {
  const row = await findTagById(id);
  if (!row) throw notFound();
  return toPublicTag(row);
}

export async function createTagService(data: {
  name: string;
  description: string | null;
  isActive: boolean;
}): Promise<PublicTag> {
  if (await tagNameExists(data.name)) {
    throw conflict('Ya existe una etiqueta con ese nombre');
  }
  const id = await createTag(data);
  return getTagService(id);
}

export async function updateTagService(
  id: number,
  data: { name: string; description: string | null; isActive: boolean },
): Promise<PublicTag> {
  const existing = await findTagById(id);
  if (!existing) throw notFound();

  if (await tagNameExists(data.name, id)) {
    throw conflict('Ya existe una etiqueta con ese nombre');
  }

  await updateTag(id, data);
  return getTagService(id);
}

export async function toggleTagService(id: number, isActive: boolean): Promise<PublicTag> {
  const existing = await findTagById(id);
  if (!existing) throw notFound();
  await setTagActive(id, isActive);
  return getTagService(id);
}

export async function deleteTagService(id: number): Promise<void> {
  const existing = await findTagById(id);
  if (!existing) throw notFound();
  const documentCount = await countDocumentLinksByTag(id);
  if (documentCount > 0) {
    throw conflict(
      `No se puede eliminar: la etiqueta tiene ${documentCount} documento${documentCount === 1 ? '' : 's'} asociado${documentCount === 1 ? '' : 's'}`,
    );
  }
  await deleteTag(id);
}
