import sql from 'mssql';
import { getPool } from '../config/database';

export interface ChatRoomRow {
  id: number;
  name: string | null;
  isGroup: boolean;
  areaId: number | null;
  createdAt: Date;
  lastMessageAt: Date;
}

export interface ChatMessageRow {
  id: number;
  roomId: number;
  senderId: number;
  messageText: string | null;
  fileUrl: string | null;
  fileName: string | null;
  fileType: string | null;
  createdAt: Date;
  senderFirstName?: string;
  senderLastName?: string;
  senderAvatarUrl?: string | null;
}

export async function syncAreaRoomParticipants(): Promise<void> {
  const pool = getPool();
  await pool.request().query(`
    INSERT INTO dbo.ChatRooms (name, isGroup, areaId, createdAt, lastMessageAt)
    SELECT a.name, 1, a.id, SYSUTCDATETIME(), SYSUTCDATETIME()
    FROM dbo.Areas a
    WHERE a.isActive = 1
      AND NOT EXISTS (SELECT 1 FROM dbo.ChatRooms r WHERE r.areaId = a.id);

    INSERT INTO dbo.ChatParticipants (roomId, userId, joinedAt, lastReadAt)
    SELECT r.id, u.id, SYSUTCDATETIME(), SYSUTCDATETIME()
    FROM dbo.ChatRooms r
    INNER JOIN dbo.Users u ON u.areaId = r.areaId AND u.isActive = 1
    WHERE r.isGroup = 1 AND r.areaId IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM dbo.ChatParticipants p WHERE p.roomId = r.id AND p.userId = u.id
      );

    INSERT INTO dbo.ChatParticipants (roomId, userId, joinedAt, lastReadAt)
    SELECT r.id, caa.userId, SYSUTCDATETIME(), SYSUTCDATETIME()
    FROM dbo.ChatAreaAccess caa
    INNER JOIN dbo.ChatRooms r ON r.areaId = caa.areaId AND r.isGroup = 1
    INNER JOIN dbo.Users u ON u.id = caa.userId AND u.isActive = 1
    WHERE caa.isActive = 1
      AND NOT EXISTS (
        SELECT 1 FROM dbo.ChatParticipants p WHERE p.roomId = r.id AND p.userId = caa.userId
      );
  `);
}

export async function isUserInRoom(roomId: number, userId: number): Promise<boolean> {
  const pool = getPool();
  const result = await pool
    .request()
    .input('roomId', sql.Int, roomId)
    .input('userId', sql.Int, userId).query<{ ok: number }>(`
      SELECT 1 AS ok FROM dbo.ChatParticipants WHERE roomId = @roomId AND userId = @userId
    `);
  return result.recordset.length > 0;
}

export async function listUserRoomIds(userId: number): Promise<number[]> {
  const pool = getPool();
  const result = await pool.request().input('userId', sql.Int, userId).query<{ roomId: number }>(`
    SELECT roomId FROM dbo.ChatParticipants WHERE userId = @userId
  `);
  return result.recordset.map((r) => r.roomId);
}

export interface RoomListRow {
  id: number;
  name: string | null;
  isGroup: boolean;
  areaId: number | null;
  areaName: string | null;
  lastMessageAt: Date;
  lastMessageText: string | null;
  lastMessageFileName: string | null;
  lastSenderFirstName: string | null;
  lastSenderLastName: string | null;
  unreadCount: number;
  peerUserId: number | null;
  peerFirstName: string | null;
  peerLastName: string | null;
  peerAvatarUrl: string | null;
  peerAreaName: string | null;
}

export async function listRoomsForUser(userId: number): Promise<RoomListRow[]> {
  const pool = getPool();
  const result = await pool.request().input('userId', sql.Int, userId).query<RoomListRow>(`
    WITH LastMsg AS (
      SELECT m.roomId, m.messageText, m.fileName, m.createdAt,
             u.firstName AS lastSenderFirstName, u.lastName AS lastSenderLastName,
             ROW_NUMBER() OVER (PARTITION BY m.roomId ORDER BY m.createdAt DESC, m.id DESC) AS rn
      FROM dbo.ChatMessages m
      INNER JOIN dbo.Users u ON u.id = m.senderId
    )
    SELECT
      r.id,
      r.name,
      r.isGroup,
      r.areaId,
      a.name AS areaName,
      r.lastMessageAt,
      lm.messageText AS lastMessageText,
      lm.fileName AS lastMessageFileName,
      lm.lastSenderFirstName,
      lm.lastSenderLastName,
      ISNULL(uc.unreadCount, 0) AS unreadCount,
      peer.userId AS peerUserId,
      peer.firstName AS peerFirstName,
      peer.lastName AS peerLastName,
      peer.avatarUrl AS peerAvatarUrl,
      pa.name AS peerAreaName
    FROM dbo.ChatRooms r
    INNER JOIN dbo.ChatParticipants cp ON cp.roomId = r.id AND cp.userId = @userId
    LEFT JOIN dbo.Areas a ON a.id = r.areaId
    LEFT JOIN LastMsg lm ON lm.roomId = r.id AND lm.rn = 1
    LEFT JOIN (
      SELECT p.roomId, COUNT(*) AS unreadCount
      FROM dbo.ChatMessages m
      INNER JOIN dbo.ChatParticipants p ON p.roomId = m.roomId AND p.userId = @userId
      WHERE m.senderId <> @userId
        AND (p.lastReadAt IS NULL OR m.createdAt > p.lastReadAt)
      GROUP BY p.roomId
    ) uc ON uc.roomId = r.id
    OUTER APPLY (
      SELECT TOP 1 u.id AS userId, u.firstName, u.lastName, u.avatarUrl, u.areaId
      FROM dbo.ChatParticipants op
      INNER JOIN dbo.Users u ON u.id = op.userId
      WHERE op.roomId = r.id AND r.isGroup = 0 AND op.userId <> @userId
    ) peer
    LEFT JOIN dbo.Areas pa ON pa.id = peer.areaId
    ORDER BY r.lastMessageAt DESC, r.id DESC
  `);
  return result.recordset;
}

export async function findDirectRoomId(userA: number, userB: number): Promise<number | null> {
  const pool = getPool();
  const result = await pool.request().input('userA', sql.Int, userA).input('userB', sql.Int, userB)
    .query<{ id: number }>(`
      SELECT r.id
      FROM dbo.ChatRooms r
      WHERE r.isGroup = 0
        AND EXISTS (SELECT 1 FROM dbo.ChatParticipants p WHERE p.roomId = r.id AND p.userId = @userA)
        AND EXISTS (SELECT 1 FROM dbo.ChatParticipants p WHERE p.roomId = r.id AND p.userId = @userB)
        AND (SELECT COUNT(*) FROM dbo.ChatParticipants p WHERE p.roomId = r.id) = 2
    `);
  return result.recordset[0]?.id ?? null;
}

export async function createDirectRoom(userA: number, userB: number): Promise<number> {
  const pool = getPool();
  const tx = new sql.Transaction(pool);
  await tx.begin();
  try {
    const roomResult = await new sql.Request(tx).query<{ id: number }>(`
      INSERT INTO dbo.ChatRooms (name, isGroup, areaId, lastMessageAt)
      OUTPUT INSERTED.id
      VALUES (NULL, 0, NULL, SYSUTCDATETIME())
    `);
    const roomId = roomResult.recordset[0]!.id;
    for (const userId of [userA, userB]) {
      await new sql.Request(tx).input('roomId', sql.Int, roomId).input('userId', sql.Int, userId)
        .query(`
          INSERT INTO dbo.ChatParticipants (roomId, userId, lastReadAt)
          VALUES (@roomId, @userId, SYSUTCDATETIME())
        `);
    }
    await tx.commit();
    return roomId;
  } catch (e) {
    await tx.rollback();
    throw e;
  }
}

export async function insertMessage(data: {
  roomId: number;
  senderId: number;
  messageText: string | null;
  fileUrl: string | null;
  fileName: string | null;
  fileType: string | null;
}): Promise<number> {
  const pool = getPool();
  const result = await pool
    .request()
    .input('roomId', sql.Int, data.roomId)
    .input('senderId', sql.Int, data.senderId)
    .input('messageText', sql.NVarChar(sql.MAX), data.messageText)
    .input('fileUrl', sql.NVarChar(500), data.fileUrl)
    .input('fileName', sql.NVarChar(300), data.fileName)
    .input('fileType', sql.NVarChar(100), data.fileType).query<{ id: number }>(`
      INSERT INTO dbo.ChatMessages (roomId, senderId, messageText, fileUrl, fileName, fileType)
      OUTPUT INSERTED.id
      VALUES (@roomId, @senderId, @messageText, @fileUrl, @fileName, @fileType);

      UPDATE dbo.ChatRooms SET lastMessageAt = SYSUTCDATETIME() WHERE id = @roomId;
    `);
  return result.recordset[0]!.id;
}

export async function findMessageById(messageId: number): Promise<ChatMessageRow | null> {
  const pool = getPool();
  const result = await pool.request().input('id', sql.Int, messageId).query<ChatMessageRow>(`
    SELECT m.id, m.roomId, m.senderId, m.messageText, m.fileUrl, m.fileName, m.fileType, m.createdAt,
           u.firstName AS senderFirstName, u.lastName AS senderLastName, u.avatarUrl AS senderAvatarUrl
    FROM dbo.ChatMessages m
    INNER JOIN dbo.Users u ON u.id = m.senderId
    WHERE m.id = @id
  `);
  return result.recordset[0] ?? null;
}

export async function listMessages(
  roomId: number,
  beforeId: number | null,
  limit: number,
): Promise<ChatMessageRow[]> {
  const pool = getPool();
  const request = pool.request().input('roomId', sql.Int, roomId).input('limit', sql.Int, limit);

  let beforeClause = '';
  if (beforeId != null) {
    request.input('beforeId', sql.Int, beforeId);
    beforeClause = 'AND m.id < @beforeId';
  }

  const result = await request.query<ChatMessageRow>(`
    SELECT TOP (@limit)
      m.id, m.roomId, m.senderId, m.messageText, m.fileUrl, m.fileName, m.fileType, m.createdAt,
      u.firstName AS senderFirstName, u.lastName AS senderLastName, u.avatarUrl AS senderAvatarUrl
    FROM dbo.ChatMessages m
    INNER JOIN dbo.Users u ON u.id = m.senderId
    WHERE m.roomId = @roomId ${beforeClause}
    ORDER BY m.id DESC
  `);
  return result.recordset.reverse();
}

export async function updateLastReadAt(roomId: number, userId: number): Promise<void> {
  const pool = getPool();
  await pool.request().input('roomId', sql.Int, roomId).input('userId', sql.Int, userId).query(`
      UPDATE dbo.ChatParticipants
      SET lastReadAt = SYSUTCDATETIME()
      WHERE roomId = @roomId AND userId = @userId
    `);
}

export async function listRoomParticipantIds(roomId: number): Promise<number[]> {
  const pool = getPool();
  const result = await pool.request().input('roomId', sql.Int, roomId).query<{ userId: number }>(`
    SELECT userId FROM dbo.ChatParticipants WHERE roomId = @roomId
  `);
  return result.recordset.map((r) => r.userId);
}

export async function findRoomById(roomId: number): Promise<ChatRoomRow | null> {
  const pool = getPool();
  const result = await pool.request().input('id', sql.Int, roomId).query<ChatRoomRow>(`
    SELECT id, name, isGroup, areaId, createdAt, lastMessageAt FROM dbo.ChatRooms WHERE id = @id
  `);
  return result.recordset[0] ?? null;
}

export async function countTotalUnread(userId: number): Promise<number> {
  const pool = getPool();
  const result = await pool.request().input('userId', sql.Int, userId).query<{ total: number }>(`
    SELECT COUNT(*) AS total
    FROM dbo.ChatMessages m
    INNER JOIN dbo.ChatParticipants p ON p.roomId = m.roomId AND p.userId = @userId
    WHERE m.senderId <> @userId
      AND (p.lastReadAt IS NULL OR m.createdAt > p.lastReadAt)
  `);
  return result.recordset[0]?.total ?? 0;
}
