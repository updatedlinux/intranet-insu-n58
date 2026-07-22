import { NOTIFICATION_RESOURCE_TYPES, NOTIFICATION_TYPES } from '../constants/notification-type';
import { inferChatFileCategory } from '../constants/chat';
import {
  createDirectRoom,
  findDirectRoomId,
  findMessageById,
  findRoomById,
  insertMessage,
  isUserInRoom,
  listMessages,
  listRoomParticipantIds,
  listRoomsForUser,
  listUserRoomIds,
  syncAreaRoomParticipants,
  updateLastReadAt,
  countTotalUnread,
} from '../repositories/chat.repository';
import type { AuthenticatedUser } from '../types/auth';
import { resolvePublicAvatarUrl } from '../utils/avatar-url';
import { getChatFileStream, uploadChatFile } from './chat-storage.service';
import { createNotification } from './notification.service';

const viewingRoomsByUser = new Map<number, Set<number>>();

export function setUserViewingRoom(userId: number, roomId: number | null): void {
  if (roomId == null) {
    viewingRoomsByUser.delete(userId);
    return;
  }
  viewingRoomsByUser.set(userId, new Set([roomId]));
}

export function clearUserViewing(userId: number): void {
  viewingRoomsByUser.delete(userId);
}

export function isUserViewingRoom(userId: number, roomId: number): boolean {
  return viewingRoomsByUser.get(userId)?.has(roomId) ?? false;
}

function mapMessage(row: Awaited<ReturnType<typeof findMessageById>>, currentUserId: number) {
  if (!row) return null;
  const category = row.fileType ? inferChatFileCategory(row.fileType) : null;
  return {
    id: row.id,
    roomId: row.roomId,
    senderId: row.senderId,
    senderName: `${row.senderFirstName ?? ''} ${row.senderLastName ?? ''}`.trim(),
    senderAvatarUrl: resolvePublicAvatarUrl(row.senderId, row.senderAvatarUrl ?? null),
    messageText: row.messageText,
    fileName: row.fileName,
    fileType: row.fileType,
    fileCategory: category,
    hasFile: Boolean(row.fileUrl),
    createdAt: row.createdAt.toISOString(),
    isOwn: row.senderId === currentUserId,
  };
}

function mapRoomListItem(row: Awaited<ReturnType<typeof listRoomsForUser>>[number]) {
  let displayName = row.name;
  if (!row.isGroup && row.peerFirstName) {
    displayName = `${row.peerFirstName} ${row.peerLastName ?? ''}`.trim();
  }

  let lastPreview = row.lastMessageText ?? '';
  if (!lastPreview && row.lastMessageFileName) {
    lastPreview = `📎 ${row.lastMessageFileName}`;
  }
  if (row.lastSenderFirstName && lastPreview) {
    lastPreview = `${row.lastSenderFirstName}: ${lastPreview}`;
  }

  return {
    id: row.id,
    name: displayName,
    isGroup: row.isGroup,
    areaId: row.areaId,
    areaName: row.areaName,
    lastMessageAt: row.lastMessageAt.toISOString(),
    lastPreview,
    unreadCount: row.unreadCount,
    peer: row.peerUserId
      ? {
          id: row.peerUserId,
          fullName: `${row.peerFirstName ?? ''} ${row.peerLastName ?? ''}`.trim(),
          avatarUrl: resolvePublicAvatarUrl(row.peerUserId, row.peerAvatarUrl),
          areaName: row.peerAreaName,
        }
      : null,
  };
}

export async function listUserRoomsService(user: AuthenticatedUser) {
  await syncAreaRoomParticipants();
  const rows = await listRoomsForUser(user.id);
  return {
    items: rows.map(mapRoomListItem),
    totalUnread: rows.reduce((sum, r) => sum + r.unreadCount, 0),
  };
}

export async function getRoomMessagesService(
  user: AuthenticatedUser,
  roomId: number,
  beforeId?: number,
  limit = 40,
) {
  const allowed = await isUserInRoom(roomId, user.id);
  if (!allowed) {
    throw Object.assign(new Error('No tiene acceso a esta conversación'), { statusCode: 403 });
  }

  const safeLimit = Math.min(Math.max(limit, 1), 100);
  const rows = await listMessages(roomId, beforeId ?? null, safeLimit);
  return {
    items: rows.map((r) => mapMessage(r as Parameters<typeof mapMessage>[0], user.id)!),
    hasMore: rows.length === safeLimit,
  };
}

export async function getOrCreateDirectRoomService(user: AuthenticatedUser, targetUserId: number) {
  if (targetUserId === user.id) {
    throw Object.assign(new Error('No puede chatear consigo mismo'), { statusCode: 400 });
  }

  await syncAreaRoomParticipants();
  let roomId = await findDirectRoomId(user.id, targetUserId);
  if (!roomId) {
    try {
      roomId = await createDirectRoom(user.id, targetUserId);
    } catch (error) {
      roomId = await findDirectRoomId(user.id, targetUserId);
      if (!roomId) throw error;
    }
  }

  const rooms = await listRoomsForUser(user.id);
  const room = rooms.find((r) => r.id === roomId);
  if (!room) {
    throw Object.assign(new Error('No se pudo abrir la conversación'), { statusCode: 500 });
  }
  return { room: mapRoomListItem(room) };
}

export async function uploadChatAttachmentService(
  user: AuthenticatedUser,
  roomId: number,
  file: { buffer: Buffer; mimetype: string; originalname: string },
) {
  const allowed = await isUserInRoom(roomId, user.id);
  if (!allowed) {
    throw Object.assign(new Error('No tiene acceso a esta conversación'), { statusCode: 403 });
  }
  return uploadChatFile(roomId, file.buffer, file.mimetype, file.originalname);
}

export async function streamChatFileService(user: AuthenticatedUser, messageId: number) {
  const message = await findMessageById(messageId);
  if (!message?.fileUrl) {
    throw Object.assign(new Error('Archivo no encontrado'), { statusCode: 404 });
  }
  const allowed = await isUserInRoom(message.roomId, user.id);
  if (!allowed) {
    throw Object.assign(new Error('No tiene acceso'), { statusCode: 403 });
  }
  return getChatFileStream(message.fileUrl);
}

export async function sendMessageService(
  user: AuthenticatedUser,
  roomId: number,
  payload: {
    messageText?: string | null;
    fileUrl?: string | null;
    fileName?: string | null;
    fileType?: string | null;
  },
) {
  const allowed = await isUserInRoom(roomId, user.id);
  if (!allowed) {
    throw Object.assign(new Error('No tiene acceso a esta conversación'), { statusCode: 403 });
  }

  const text = payload.messageText?.trim() || null;
  if (!text && !payload.fileUrl) {
    throw Object.assign(new Error('El mensaje está vacío'), { statusCode: 400 });
  }

  const messageId = await insertMessage({
    roomId,
    senderId: user.id,
    messageText: text,
    fileUrl: payload.fileUrl ?? null,
    fileName: payload.fileName ?? null,
    fileType: payload.fileType ?? null,
  });

  await updateLastReadAt(roomId, user.id);
  const message = await findMessageById(messageId);
  const publicMsg = mapMessage(message, user.id)!;

  const room = await findRoomById(roomId);
  const participants = await listRoomParticipantIds(roomId);
  const senderName = `${user.firstName} ${user.lastName}`.trim();
  const preview = text ?? (payload.fileName ? `📎 ${payload.fileName}` : 'Nuevo mensaje');
  const roomLabel = room?.isGroup ? (room.name ?? 'Grupo') : senderName;

  for (const participantId of participants) {
    if (participantId === user.id) continue;
    if (isUserViewingRoom(participantId, roomId)) continue;
    void createNotification(
      participantId,
      NOTIFICATION_TYPES.CHAT_MESSAGE,
      `Mensaje de ${senderName}`,
      `${roomLabel}: ${preview}`.slice(0, 500),
      NOTIFICATION_RESOURCE_TYPES.CHAT,
      roomId,
    ).catch((err) => console.error('[chat] notification error:', err));
  }

  return publicMsg;
}

export async function markRoomReadService(user: AuthenticatedUser, roomId: number): Promise<void> {
  const allowed = await isUserInRoom(roomId, user.id);
  if (!allowed) {
    throw Object.assign(new Error('No tiene acceso a esta conversación'), { statusCode: 403 });
  }
  await updateLastReadAt(roomId, user.id);
}

export async function getUserRoomIdsForSocket(userId: number): Promise<number[]> {
  await syncAreaRoomParticipants();
  return listUserRoomIds(userId);
}

export async function getUnreadCountService(userId: number): Promise<number> {
  return countTotalUnread(userId);
}
