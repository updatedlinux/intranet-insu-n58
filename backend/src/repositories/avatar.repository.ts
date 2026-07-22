import sql from 'mssql';
import { getPool } from '../config/database';

export async function findUserAvatarUrl(userId: number): Promise<string | null> {
  const pool = getPool();
  const result = await pool.request().input('id', sql.Int, userId).query<{
    avatarUrl: string | null;
  }>(`
      SELECT avatarUrl
      FROM dbo.Users
      WHERE id = @id
    `);
  return result.recordset[0]?.avatarUrl ?? null;
}

export async function updateUserAvatarUrl(userId: number, avatarUrl: string | null): Promise<void> {
  const pool = getPool();
  await pool.request().input('id', sql.Int, userId).input('avatarUrl', sql.NVarChar(512), avatarUrl)
    .query(`
      UPDATE dbo.Users
      SET avatarUrl = @avatarUrl, updatedAt = SYSUTCDATETIME()
      WHERE id = @id
    `);
}

export async function userExists(userId: number): Promise<boolean> {
  const pool = getPool();
  const result = await pool.request().input('id', sql.Int, userId).query<{ found: number }>(`
      SELECT 1 AS found
      FROM dbo.Users
      WHERE id = @id
    `);
  return (result.recordset[0]?.found ?? 0) > 0;
}
