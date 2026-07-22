import sql from 'mssql';
import { getPool } from '../config/database';
import type { UserRecord } from './user.repository';

export interface CollaboratorListFilters {
  search?: string;
  email?: string;
  roleId?: number;
  isActive?: boolean;
  areaId?: number;
  positionId?: number;
  page?: number;
  pageSize?: number;
}

export interface CollaboratorListRow extends Omit<UserRecord, 'passwordHash'> {
  avatarUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
  createdBy: number | null;
}

export interface CreateUserInput {
  firstName: string;
  lastName: string;
  email: string;
  passwordHash: string;
  roleId: number;
  areaId: number;
  positionId: number;
  isActive: boolean;
  mustChangePassword: boolean;
  createdBy: number | null;
}

export interface UpdateUserInput {
  firstName: string;
  lastName: string;
  email: string;
  roleId: number;
  areaId: number;
  positionId: number;
}

const USER_SELECT = `
  u.id,
  u.firstName,
  u.lastName,
  u.email,
  u.avatarUrl,
  u.isActive,
  u.mustChangePassword,
  u.lastLoginAt,
  u.createdAt,
  u.updatedAt,
  u.createdBy,
  r.id AS roleId,
  r.name AS roleName,
  a.id AS areaId,
  a.name AS areaName,
  p.id AS positionId,
  p.name AS positionName
`;

function buildListWhere(filters: CollaboratorListFilters): {
  clause: string;
  request: sql.Request;
} {
  const pool = getPool();
  const request = pool.request();
  const conditions: string[] = ['1 = 1'];

  if (filters.search?.trim()) {
    const term = `%${filters.search.trim()}%`;
    request.input('search', sql.NVarChar(255), term);
    conditions.push(
      "(u.firstName LIKE @search OR u.lastName LIKE @search OR CONCAT(u.firstName, N' ', u.lastName) LIKE @search OR u.email LIKE @search)",
    );
  }

  if (filters.email?.trim()) {
    request.input('email', sql.NVarChar(255), `%${filters.email.trim().toLowerCase()}%`);
    conditions.push('LOWER(u.email) LIKE @email');
  }

  if (filters.roleId != null) {
    request.input('roleId', sql.Int, filters.roleId);
    conditions.push('u.roleId = @roleId');
  }

  if (filters.isActive != null) {
    request.input('isActive', sql.Bit, filters.isActive ? 1 : 0);
    conditions.push('u.isActive = @isActive');
  }

  if (filters.areaId != null) {
    request.input('areaId', sql.Int, filters.areaId);
    conditions.push('u.areaId = @areaId');
  }

  if (filters.positionId != null) {
    request.input('positionId', sql.Int, filters.positionId);
    conditions.push('u.positionId = @positionId');
  }

  return { clause: conditions.join(' AND '), request };
}

export async function listCollaborators(
  filters: CollaboratorListFilters,
): Promise<{ items: CollaboratorListRow[]; total: number }> {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, filters.pageSize ?? 20));
  const offset = (page - 1) * pageSize;

  const { clause, request } = buildListWhere(filters);
  request.input('offset', sql.Int, offset);
  request.input('pageSize', sql.Int, pageSize);

  const fromJoin = `
    FROM dbo.Users u
    INNER JOIN dbo.Roles r ON u.roleId = r.id
    INNER JOIN dbo.Areas a ON u.areaId = a.id
    INNER JOIN dbo.Positions p ON u.positionId = p.id
    WHERE ${clause}
  `;

  const countResult = await request.query<{ total: number }>(`
    SELECT COUNT(1) AS total
    ${fromJoin}
  `);
  const total = countResult.recordset[0]?.total ?? 0;

  const listResult = await request.query<CollaboratorListRow>(`
    SELECT ${USER_SELECT}
    ${fromJoin}
    ORDER BY u.lastName, u.firstName
    OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY
  `);

  return { items: listResult.recordset, total };
}

export async function emailExists(email: string, excludeUserId?: number): Promise<boolean> {
  const pool = getPool();
  const request = pool.request().input('email', sql.NVarChar(255), email.trim().toLowerCase());

  let query = `
    SELECT 1 AS found
    FROM dbo.Users
    WHERE LOWER(email) = @email
  `;

  if (excludeUserId != null) {
    request.input('excludeId', sql.Int, excludeUserId);
    query += ' AND id <> @excludeId';
  }

  const result = await request.query<{ found: number }>(query);
  return (result.recordset[0]?.found ?? 0) > 0;
}

export async function createUser(input: CreateUserInput): Promise<number> {
  const pool = getPool();
  const result = await pool
    .request()
    .input('firstName', sql.NVarChar(100), input.firstName)
    .input('lastName', sql.NVarChar(100), input.lastName)
    .input('email', sql.NVarChar(255), input.email.trim().toLowerCase())
    .input('passwordHash', sql.NVarChar(255), input.passwordHash)
    .input('roleId', sql.Int, input.roleId)
    .input('areaId', sql.Int, input.areaId)
    .input('positionId', sql.Int, input.positionId)
    .input('isActive', sql.Bit, input.isActive ? 1 : 0)
    .input('mustChangePassword', sql.Bit, input.mustChangePassword ? 1 : 0)
    .input('createdBy', sql.Int, input.createdBy).query<{ id: number }>(`
      INSERT INTO dbo.Users (
        firstName, lastName, email, passwordHash,
        roleId, areaId, positionId,
        isActive, mustChangePassword, createdBy
      )
      OUTPUT INSERTED.id
      VALUES (
        @firstName, @lastName, @email, @passwordHash,
        @roleId, @areaId, @positionId,
        @isActive, @mustChangePassword, @createdBy
      )
    `);

  return result.recordset[0]!.id;
}

export async function updateUser(id: number, input: UpdateUserInput): Promise<void> {
  const pool = getPool();
  await pool
    .request()
    .input('id', sql.Int, id)
    .input('firstName', sql.NVarChar(100), input.firstName)
    .input('lastName', sql.NVarChar(100), input.lastName)
    .input('email', sql.NVarChar(255), input.email.trim().toLowerCase())
    .input('roleId', sql.Int, input.roleId)
    .input('areaId', sql.Int, input.areaId)
    .input('positionId', sql.Int, input.positionId).query(`
      UPDATE dbo.Users
      SET
        firstName = @firstName,
        lastName = @lastName,
        email = @email,
        roleId = @roleId,
        areaId = @areaId,
        positionId = @positionId,
        updatedAt = SYSUTCDATETIME()
      WHERE id = @id
    `);
}

export async function setUserActive(id: number, isActive: boolean): Promise<void> {
  const pool = getPool();
  await pool
    .request()
    .input('id', sql.Int, id)
    .input('isActive', sql.Bit, isActive ? 1 : 0).query(`
      UPDATE dbo.Users
      SET isActive = @isActive, updatedAt = SYSUTCDATETIME()
      WHERE id = @id
    `);
}

export async function resetUserPassword(
  id: number,
  passwordHash: string,
  mustChangePassword: boolean,
): Promise<void> {
  const pool = getPool();
  await pool
    .request()
    .input('id', sql.Int, id)
    .input('passwordHash', sql.NVarChar(255), passwordHash)
    .input('mustChangePassword', sql.Bit, mustChangePassword ? 1 : 0).query(`
      UPDATE dbo.Users
      SET
        passwordHash = @passwordHash,
        mustChangePassword = @mustChangePassword,
        updatedAt = SYSUTCDATETIME()
      WHERE id = @id
    `);
}

export async function findCollaboratorById(id: number): Promise<CollaboratorListRow | null> {
  const pool = getPool();
  const result = await pool.request().input('id', sql.Int, id).query<CollaboratorListRow>(`
    SELECT ${USER_SELECT}
    FROM dbo.Users u
    INNER JOIN dbo.Roles r ON u.roleId = r.id
    INNER JOIN dbo.Areas a ON u.areaId = a.id
    INNER JOIN dbo.Positions p ON u.positionId = p.id
    WHERE u.id = @id
  `);
  return result.recordset[0] ?? null;
}

export interface UserDeletionBlockers {
  tickets: number;
  requests: number;
  documents: number;
  assets: number;
  tasks: number;
  announcements: number;
  meetings: number;
  learningCourses: number;
  corporateEvents: number;
  chatMessages: number;
  consumables: number;
  areaLeaders: number;
}

export async function getUserDeletionBlockers(userId: number): Promise<UserDeletionBlockers> {
  const pool = getPool();
  const result = await pool.request().input('userId', sql.Int, userId).query<UserDeletionBlockers>(`
    SELECT
      (SELECT COUNT(*) FROM dbo.Tickets WHERE requesterId = @userId OR assignedTo = @userId) AS tickets,
      (SELECT COUNT(*) FROM dbo.Requests WHERE requesterId = @userId) AS requests,
      (SELECT COUNT(*) FROM dbo.Documents
        WHERE createdBy = @userId OR approvedBy = @userId OR rejectedBy = @userId) AS documents,
      (SELECT COUNT(*) FROM dbo.Assets WHERE assignedTo = @userId OR createdBy = @userId) AS assets,
      (SELECT COUNT(*) FROM dbo.Tasks WHERE createdBy = @userId) AS tasks,
      (SELECT COUNT(*) FROM dbo.Announcements WHERE createdBy = @userId) AS announcements,
      (SELECT COUNT(*) FROM dbo.Meetings WHERE organizerId = @userId) AS meetings,
      (SELECT COUNT(*) FROM dbo.LearningCourses WHERE createdBy = @userId) AS learningCourses,
      (SELECT COUNT(*) FROM dbo.CorporateEvents WHERE createdBy = @userId) AS corporateEvents,
      (SELECT COUNT(*) FROM dbo.ChatMessages WHERE senderId = @userId) AS chatMessages,
      (SELECT COUNT(*) FROM dbo.Consumables WHERE createdBy = @userId) AS consumables,
      (SELECT COUNT(*) FROM dbo.AreaLeaders WHERE userId = @userId) AS areaLeaders
  `);
  return result.recordset[0]!;
}

export async function updateUsersAreaByPosition(
  positionId: number,
  areaId: number,
  transaction?: sql.Transaction,
): Promise<void> {
  const request = transaction ? new sql.Request(transaction) : getPool().request();
  await request.input('positionId', sql.Int, positionId).input('areaId', sql.Int, areaId).query(`
      UPDATE dbo.Users
      SET areaId = @areaId, updatedAt = SYSUTCDATETIME()
      WHERE positionId = @positionId
    `);
}

export async function deleteUser(userId: number): Promise<void> {
  const pool = getPool();
  const transaction = new sql.Transaction(pool);
  await transaction.begin();

  try {
    const run = () => new sql.Request(transaction);

    await run().input('userId', sql.Int, userId).query(`
      UPDATE dbo.Users SET createdBy = NULL WHERE createdBy = @userId
    `);

    await run()
      .input('userId', sql.Int, userId)
      .query(`DELETE FROM dbo.AreaLeaders WHERE userId = @userId`);
    await run()
      .input('userId', sql.Int, userId)
      .query(`DELETE FROM dbo.ChatAreaAccess WHERE userId = @userId`);
    await run()
      .input('userId', sql.Int, userId)
      .query(`DELETE FROM dbo.ChatParticipants WHERE userId = @userId`);
    await run()
      .input('userId', sql.Int, userId)
      .query(`DELETE FROM dbo.Notifications WHERE userId = @userId`);
    await run()
      .input('userId', sql.Int, userId)
      .query(`DELETE FROM dbo.TaskAssignees WHERE userId = @userId`);
    await run()
      .input('userId', sql.Int, userId)
      .query(`DELETE FROM dbo.LearningUserProgress WHERE userId = @userId`);
    await run()
      .input('userId', sql.Int, userId)
      .query(`DELETE FROM dbo.LearningCourseExceptions WHERE userId = @userId`);
    await run()
      .input('userId', sql.Int, userId)
      .query(`DELETE FROM dbo.MeetingAttendees WHERE userId = @userId`);
    await run()
      .input('userId', sql.Int, userId)
      .query(`DELETE FROM dbo.MeetingReminderLog WHERE userId = @userId`);
    await run()
      .input('userId', sql.Int, userId)
      .query(`DELETE FROM dbo.DocumentLogs WHERE userId = @userId`);
    await run()
      .input('userId', sql.Int, userId)
      .query(`DELETE FROM dbo.AuditLogs WHERE actorUserId = @userId`);
    await run().input('userId', sql.Int, userId).query(`DELETE FROM dbo.Users WHERE id = @userId`);

    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}
