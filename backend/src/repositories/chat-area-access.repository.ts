import sql from 'mssql';
import { getPool } from '../config/database';

export interface ChatAreaAccessRow {
  id: number;
  userId: number;
  areaId: number;
  userFirstName: string;
  userLastName: string;
  userEmail: string;
  userAreaName: string;
  areaName: string;
  notes: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ChatAreaAccessWriteInput {
  userId: number;
  areaId: number;
  notes: string | null;
  isActive: boolean;
}

const SELECT = `
  caa.id,
  caa.userId,
  caa.areaId,
  u.firstName AS userFirstName,
  u.lastName AS userLastName,
  u.email AS userEmail,
  ua.name AS userAreaName,
  a.name AS areaName,
  caa.notes,
  caa.isActive,
  caa.createdAt,
  caa.updatedAt
`;

const FROM = `
  FROM dbo.ChatAreaAccess caa
  INNER JOIN dbo.Users u ON u.id = caa.userId
  INNER JOIN dbo.Areas a ON a.id = caa.areaId
  INNER JOIN dbo.Areas ua ON ua.id = u.areaId
`;

export async function listChatAreaAccess(filters?: {
  userId?: number;
  areaId?: number;
  isActive?: boolean;
}): Promise<ChatAreaAccessRow[]> {
  const pool = getPool();
  const request = pool.request();
  const conditions = ['1 = 1'];

  if (filters?.userId != null) {
    request.input('userId', sql.Int, filters.userId);
    conditions.push('caa.userId = @userId');
  }
  if (filters?.areaId != null) {
    request.input('areaId', sql.Int, filters.areaId);
    conditions.push('caa.areaId = @areaId');
  }
  if (filters?.isActive != null) {
    request.input('isActive', sql.Bit, filters.isActive ? 1 : 0);
    conditions.push('caa.isActive = @isActive');
  }

  const result = await request.query<ChatAreaAccessRow>(`
    SELECT ${SELECT}
    ${FROM}
    WHERE ${conditions.join(' AND ')}
    ORDER BY u.lastName, u.firstName, a.name
  `);
  return result.recordset;
}

export async function findChatAreaAccessById(id: number): Promise<ChatAreaAccessRow | null> {
  const pool = getPool();
  const result = await pool.request().input('id', sql.Int, id).query<ChatAreaAccessRow>(`
    SELECT ${SELECT}
    ${FROM}
    WHERE caa.id = @id
  `);
  return result.recordset[0] ?? null;
}

export async function createChatAreaAccess(input: ChatAreaAccessWriteInput): Promise<number> {
  const pool = getPool();
  const result = await pool
    .request()
    .input('userId', sql.Int, input.userId)
    .input('areaId', sql.Int, input.areaId)
    .input('notes', sql.NVarChar(500), input.notes)
    .input('isActive', sql.Bit, input.isActive ? 1 : 0).query<{ id: number }>(`
      INSERT INTO dbo.ChatAreaAccess (userId, areaId, notes, isActive)
      OUTPUT INSERTED.id
      VALUES (@userId, @areaId, @notes, @isActive)
    `);
  return result.recordset[0]!.id;
}

export async function updateChatAreaAccess(
  id: number,
  input: ChatAreaAccessWriteInput,
): Promise<void> {
  const pool = getPool();
  await pool
    .request()
    .input('id', sql.Int, id)
    .input('userId', sql.Int, input.userId)
    .input('areaId', sql.Int, input.areaId)
    .input('notes', sql.NVarChar(500), input.notes)
    .input('isActive', sql.Bit, input.isActive ? 1 : 0).query(`
      UPDATE dbo.ChatAreaAccess
      SET
        userId = @userId,
        areaId = @areaId,
        notes = @notes,
        isActive = @isActive,
        updatedAt = SYSUTCDATETIME()
      WHERE id = @id
    `);
}

export async function deleteChatAreaAccess(id: number): Promise<void> {
  const pool = getPool();
  await pool.request().input('id', sql.Int, id).query(`
    DELETE FROM dbo.ChatAreaAccess WHERE id = @id
  `);
}

export async function addUserToAreaRoom(userId: number, areaId: number): Promise<void> {
  const pool = getPool();
  await pool.request().input('userId', sql.Int, userId).input('areaId', sql.Int, areaId).query(`
      INSERT INTO dbo.ChatParticipants (roomId, userId, joinedAt, lastReadAt)
      SELECT r.id, @userId, SYSUTCDATETIME(), SYSUTCDATETIME()
      FROM dbo.ChatRooms r
      WHERE r.isGroup = 1 AND r.areaId = @areaId
        AND NOT EXISTS (
          SELECT 1 FROM dbo.ChatParticipants p WHERE p.roomId = r.id AND p.userId = @userId
        )
    `);
}

export async function removeUserFromAreaRoomIfException(
  userId: number,
  areaId: number,
): Promise<void> {
  const pool = getPool();
  await pool.request().input('userId', sql.Int, userId).input('areaId', sql.Int, areaId).query(`
      DELETE p
      FROM dbo.ChatParticipants p
      INNER JOIN dbo.ChatRooms r ON r.id = p.roomId
      INNER JOIN dbo.Users u ON u.id = p.userId
      WHERE p.userId = @userId
        AND r.isGroup = 1
        AND r.areaId = @areaId
        AND u.areaId <> @areaId
    `);
}
