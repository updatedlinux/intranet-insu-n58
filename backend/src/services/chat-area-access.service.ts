import sql from 'mssql';
import { getPool } from '../config/database';
import {
  addUserToAreaRoom,
  createChatAreaAccess,
  deleteChatAreaAccess,
  findChatAreaAccessById,
  listChatAreaAccess,
  removeUserFromAreaRoomIfException,
  updateChatAreaAccess,
  type ChatAreaAccessWriteInput,
} from '../repositories/chat-area-access.repository';
import { syncAreaRoomParticipants } from '../repositories/chat.repository';
import type { AppError } from '../middlewares/error.middleware';

function notFound(message: string): AppError {
  const error = new Error(message) as AppError;
  error.statusCode = 404;
  return error;
}

function badRequest(message: string): AppError {
  const error = new Error(message) as AppError;
  error.statusCode = 400;
  return error;
}

function mapRow(row: NonNullable<Awaited<ReturnType<typeof findChatAreaAccessById>>>) {
  return {
    id: row.id,
    userId: row.userId,
    areaId: row.areaId,
    userFullName: `${row.userFirstName} ${row.userLastName}`.trim(),
    userEmail: row.userEmail,
    userAreaName: row.userAreaName,
    areaName: row.areaName,
    notes: row.notes,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function assertUserAndArea(userId: number, areaId: number): Promise<void> {
  const pool = getPool();
  const userResult = await pool.request().input('userId', sql.Int, userId).query<{
    areaId: number;
  }>(`
    SELECT areaId FROM dbo.Users WHERE id = @userId AND isActive = 1
  `);
  if (!userResult.recordset[0]) throw notFound('Colaborador no encontrado');

  const areaResult = await pool.request().input('areaId', sql.Int, areaId).query<{ id: number }>(`
    SELECT id FROM dbo.Areas WHERE id = @areaId AND isActive = 1
  `);
  if (!areaResult.recordset[0]) throw notFound('Área no encontrada');

  if (userResult.recordset[0].areaId === areaId) {
    throw badRequest('El colaborador ya pertenece a esa unidad; no requiere excepción.');
  }
}

async function applyAccess(input: ChatAreaAccessWriteInput): Promise<void> {
  if (input.isActive) {
    await addUserToAreaRoom(input.userId, input.areaId);
  } else {
    await removeUserFromAreaRoomIfException(input.userId, input.areaId);
  }
}

export async function listChatAreaAccessService(filters?: {
  userId?: number;
  areaId?: number;
  isActive?: boolean;
}) {
  const items = await listChatAreaAccess(filters);
  return { items: items.map(mapRow) };
}

export async function getChatAreaAccessService(id: number) {
  const row = await findChatAreaAccessById(id);
  if (!row) throw notFound('Excepción de chat no encontrada');
  return mapRow(row);
}

export async function createChatAreaAccessService(input: ChatAreaAccessWriteInput) {
  await assertUserAndArea(input.userId, input.areaId);
  const id = await createChatAreaAccess(input);
  await applyAccess(input);
  await syncAreaRoomParticipants();
  const row = await findChatAreaAccessById(id);
  if (!row) throw notFound('Excepción de chat no encontrada');
  return mapRow(row);
}

export async function updateChatAreaAccessService(id: number, input: ChatAreaAccessWriteInput) {
  const existing = await findChatAreaAccessById(id);
  if (!existing) throw notFound('Excepción de chat no encontrada');

  await assertUserAndArea(input.userId, input.areaId);

  if (existing.areaId !== input.areaId || existing.userId !== input.userId) {
    await removeUserFromAreaRoomIfException(existing.userId, existing.areaId);
  }

  await updateChatAreaAccess(id, input);
  await applyAccess(input);
  await syncAreaRoomParticipants();

  const row = await findChatAreaAccessById(id);
  if (!row) throw notFound('Excepción de chat no encontrada');
  return mapRow(row);
}

export async function deleteChatAreaAccessService(id: number): Promise<void> {
  const existing = await findChatAreaAccessById(id);
  if (!existing) throw notFound('Excepción de chat no encontrada');

  await removeUserFromAreaRoomIfException(existing.userId, existing.areaId);
  await deleteChatAreaAccess(id);
  await syncAreaRoomParticipants();
}
