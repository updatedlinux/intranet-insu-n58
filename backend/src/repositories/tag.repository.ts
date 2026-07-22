import sql from 'mssql';
import { getPool } from '../config/database';

export interface TagRow {
  id: number;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface TagListFilters {
  name?: string;
  isActive?: boolean;
}

export interface TagWriteInput {
  name: string;
  description: string | null;
  isActive: boolean;
}

export async function listTags(filters: TagListFilters): Promise<TagRow[]> {
  const pool = getPool();
  const request = pool.request();
  const conditions: string[] = ['1 = 1'];

  if (filters.name?.trim()) {
    request.input('name', sql.NVarChar(255), `%${filters.name.trim()}%`);
    conditions.push('t.name LIKE @name');
  }

  if (filters.isActive != null) {
    request.input('isActive', sql.Bit, filters.isActive ? 1 : 0);
    conditions.push('t.isActive = @isActive');
  }

  const result = await request.query<TagRow>(`
    SELECT id, name, description, isActive, createdAt, updatedAt
    FROM dbo.Tags t
    WHERE ${conditions.join(' AND ')}
    ORDER BY t.name
  `);

  return result.recordset;
}

export async function findTagById(id: number): Promise<TagRow | null> {
  const pool = getPool();
  const result = await pool.request().input('id', sql.Int, id).query<TagRow>(`
    SELECT id, name, description, isActive, createdAt, updatedAt
    FROM dbo.Tags
    WHERE id = @id
  `);
  return result.recordset[0] ?? null;
}

export async function tagNameExists(name: string, excludeId?: number): Promise<boolean> {
  const pool = getPool();
  const request = pool.request().input('name', sql.NVarChar(100), name.trim().toLowerCase());

  let query = `
    SELECT 1 AS found
    FROM dbo.Tags
    WHERE LOWER(LTRIM(RTRIM(name))) = @name
  `;

  if (excludeId != null) {
    request.input('excludeId', sql.Int, excludeId);
    query += ' AND id <> @excludeId';
  }

  const result = await request.query<{ found: number }>(query);
  return (result.recordset[0]?.found ?? 0) > 0;
}

export async function createTag(input: TagWriteInput): Promise<number> {
  const pool = getPool();
  const result = await pool
    .request()
    .input('name', sql.NVarChar(100), input.name.trim())
    .input('description', sql.NVarChar(500), input.description)
    .input('isActive', sql.Bit, input.isActive ? 1 : 0).query<{ id: number }>(`
      INSERT INTO dbo.Tags (name, description, isActive)
      OUTPUT INSERTED.id
      VALUES (@name, @description, @isActive)
    `);
  return result.recordset[0]!.id;
}

export async function updateTag(id: number, input: TagWriteInput): Promise<void> {
  const pool = getPool();
  await pool
    .request()
    .input('id', sql.Int, id)
    .input('name', sql.NVarChar(100), input.name.trim())
    .input('description', sql.NVarChar(500), input.description)
    .input('isActive', sql.Bit, input.isActive ? 1 : 0).query(`
      UPDATE dbo.Tags
      SET name = @name,
          description = @description,
          isActive = @isActive,
          updatedAt = SYSUTCDATETIME()
      WHERE id = @id
    `);
}

export async function setTagActive(id: number, isActive: boolean): Promise<void> {
  const pool = getPool();
  await pool
    .request()
    .input('id', sql.Int, id)
    .input('isActive', sql.Bit, isActive ? 1 : 0).query(`
      UPDATE dbo.Tags
      SET isActive = @isActive, updatedAt = SYSUTCDATETIME()
      WHERE id = @id
    `);
}

export async function countDocumentLinksByTag(tagId: number): Promise<number> {
  const pool = getPool();
  const result = await pool.request().input('tagId', sql.Int, tagId).query<{ total: number }>(`
    SELECT COUNT(1) AS total
    FROM dbo.DocumentTags
    WHERE tagId = @tagId
  `);
  return result.recordset[0]?.total ?? 0;
}

export async function findTagByName(name: string): Promise<TagRow | null> {
  const pool = getPool();
  const result = await pool.request().input('name', sql.NVarChar(100), name.trim()).query<TagRow>(`
    SELECT TOP 1 id, name, description, isActive, createdAt, updatedAt
    FROM dbo.Tags
    WHERE LOWER(LTRIM(RTRIM(name))) = LOWER(LTRIM(RTRIM(@name)))
    ORDER BY id
  `);
  return result.recordset[0] ?? null;
}

export async function ensureSystemTag(name: string, description: string): Promise<number> {
  const existing = await findTagByName(name);
  if (existing) return existing.id;
  return createTag({ name, description, isActive: true });
}

export async function deleteTag(id: number): Promise<void> {
  const pool = getPool();
  await pool.request().input('id', sql.Int, id).query(`
    DELETE FROM dbo.Tags WHERE id = @id
  `);
}
