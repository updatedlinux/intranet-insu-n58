import sql from 'mssql';
import { getPool } from '../config/database';

export interface UserRecord {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  passwordHash: string;
  isActive: boolean;
  mustChangePassword: boolean;
  lastLoginAt: Date | null;
  roleId: number;
  roleName: string;
  areaId: number;
  areaName: string;
  areaIsItSupport: boolean;
  positionId: number;
  positionName: string;
  positionIsLeader: boolean;
  avatarUrl?: string | null;
}

export async function findUserByEmail(email: string): Promise<UserRecord | null> {
  const pool = getPool();
  const result = await pool.request().input('email', sql.NVarChar(255), email.trim().toLowerCase())
    .query<UserRecord>(`
      SELECT
        u.id,
        u.firstName,
        u.lastName,
        u.email,
        u.passwordHash,
        u.isActive,
        u.mustChangePassword,
        u.lastLoginAt,
        u.avatarUrl,
        r.id AS roleId,
        r.name AS roleName,
        a.id AS areaId,
        a.name AS areaName,
        a.isItSupportArea AS areaIsItSupport,
        p.id AS positionId,
        p.name AS positionName,
        p.isLeader AS positionIsLeader
      FROM dbo.Users u
      INNER JOIN dbo.Roles r ON u.roleId = r.id
      INNER JOIN dbo.Areas a ON u.areaId = a.id
      INNER JOIN dbo.Positions p ON u.positionId = p.id
      WHERE LOWER(u.email) = @email
    `);

  return result.recordset[0] ?? null;
}

export async function findUserById(id: number): Promise<UserRecord | null> {
  const pool = getPool();
  const result = await pool.request().input('id', sql.Int, id).query<UserRecord>(`
      SELECT
        u.id,
        u.firstName,
        u.lastName,
        u.email,
        u.passwordHash,
        u.isActive,
        u.mustChangePassword,
        u.lastLoginAt,
        u.avatarUrl,
        r.id AS roleId,
        r.name AS roleName,
        a.id AS areaId,
        a.name AS areaName,
        a.isItSupportArea AS areaIsItSupport,
        p.id AS positionId,
        p.name AS positionName,
        p.isLeader AS positionIsLeader
      FROM dbo.Users u
      INNER JOIN dbo.Roles r ON u.roleId = r.id
      INNER JOIN dbo.Areas a ON u.areaId = a.id
      INNER JOIN dbo.Positions p ON u.positionId = p.id
      WHERE u.id = @id
    `);

  return result.recordset[0] ?? null;
}

export async function updateLastLogin(userId: number): Promise<void> {
  const pool = getPool();
  await pool.request().input('id', sql.Int, userId).query(`
      UPDATE dbo.Users
      SET lastLoginAt = SYSUTCDATETIME(), updatedAt = SYSUTCDATETIME()
      WHERE id = @id
    `);
}

export async function updateUserPassword(
  userId: number,
  passwordHash: string,
  mustChangePassword: boolean,
): Promise<void> {
  const pool = getPool();
  await pool
    .request()
    .input('id', sql.Int, userId)
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
