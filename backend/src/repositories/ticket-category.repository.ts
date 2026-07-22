import sql from 'mssql';
import { getPool } from '../config/database';

export interface TicketCategoryRow {
  id: number;
  name: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface TicketCategoryListFilters {
  name?: string;
  isActive?: boolean;
}

export interface TicketCategoryWriteInput {
  name: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
}

export async function listTicketCategories(
  filters: TicketCategoryListFilters,
): Promise<TicketCategoryRow[]> {
  const pool = getPool();
  const request = pool.request();
  const conditions: string[] = ['1 = 1'];

  if (filters.name?.trim()) {
    request.input('name', sql.NVarChar(255), `%${filters.name.trim()}%`);
    conditions.push('c.name LIKE @name');
  }

  if (filters.isActive != null) {
    request.input('isActive', sql.Bit, filters.isActive ? 1 : 0);
    conditions.push('c.isActive = @isActive');
  }

  const result = await request.query<TicketCategoryRow>(`
    SELECT id, name, description, sortOrder, isActive, createdAt, updatedAt
    FROM dbo.TicketCategories c
    WHERE ${conditions.join(' AND ')}
    ORDER BY c.sortOrder, c.name
  `);

  return result.recordset.map((row) => ({
    ...row,
    isActive: Boolean(row.isActive),
  }));
}

export async function findTicketCategoryById(id: number): Promise<TicketCategoryRow | null> {
  const pool = getPool();
  const result = await pool.request().input('id', sql.Int, id).query<TicketCategoryRow>(`
    SELECT id, name, description, sortOrder, isActive, createdAt, updatedAt
    FROM dbo.TicketCategories
    WHERE id = @id
  `);
  const row = result.recordset[0];
  if (!row) return null;
  return { ...row, isActive: Boolean(row.isActive) };
}

export async function findActiveTicketCategoryById(id: number): Promise<TicketCategoryRow | null> {
  const row = await findTicketCategoryById(id);
  if (!row?.isActive) return null;
  return row;
}

export async function ticketCategoryNameExists(name: string, excludeId?: number): Promise<boolean> {
  const pool = getPool();
  const request = pool.request().input('name', sql.NVarChar(100), name.trim().toLowerCase());

  let query = `
    SELECT 1 AS found
    FROM dbo.TicketCategories
    WHERE LOWER(LTRIM(RTRIM(name))) = @name
  `;

  if (excludeId != null) {
    request.input('excludeId', sql.Int, excludeId);
    query += ' AND id <> @excludeId';
  }

  const result = await request.query<{ found: number }>(query);
  return (result.recordset[0]?.found ?? 0) > 0;
}

export async function createTicketCategory(input: TicketCategoryWriteInput): Promise<number> {
  const pool = getPool();
  const result = await pool
    .request()
    .input('name', sql.NVarChar(100), input.name.trim())
    .input('description', sql.NVarChar(500), input.description)
    .input('sortOrder', sql.Int, input.sortOrder)
    .input('isActive', sql.Bit, input.isActive ? 1 : 0).query<{ id: number }>(`
      INSERT INTO dbo.TicketCategories (name, description, sortOrder, isActive)
      OUTPUT INSERTED.id
      VALUES (@name, @description, @sortOrder, @isActive)
    `);
  return result.recordset[0]!.id;
}

export async function updateTicketCategory(
  id: number,
  input: TicketCategoryWriteInput,
): Promise<void> {
  const pool = getPool();
  await pool
    .request()
    .input('id', sql.Int, id)
    .input('name', sql.NVarChar(100), input.name.trim())
    .input('description', sql.NVarChar(500), input.description)
    .input('sortOrder', sql.Int, input.sortOrder)
    .input('isActive', sql.Bit, input.isActive ? 1 : 0).query(`
      UPDATE dbo.TicketCategories
      SET
        name = @name,
        description = @description,
        sortOrder = @sortOrder,
        isActive = @isActive,
        updatedAt = SYSUTCDATETIME()
      WHERE id = @id
    `);
}

export async function setTicketCategoryActive(id: number, isActive: boolean): Promise<void> {
  const pool = getPool();
  await pool
    .request()
    .input('id', sql.Int, id)
    .input('isActive', sql.Bit, isActive ? 1 : 0).query(`
      UPDATE dbo.TicketCategories
      SET isActive = @isActive, updatedAt = SYSUTCDATETIME()
      WHERE id = @id
    `);
}

export async function countTicketsByCategoryId(categoryId: number): Promise<number> {
  const pool = getPool();
  const result = await pool.request().input('categoryId', sql.Int, categoryId).query<{
    total: number;
  }>(`
    SELECT COUNT(1) AS total
    FROM dbo.Tickets
    WHERE categoryId = @categoryId
  `);
  return result.recordset[0]?.total ?? 0;
}

export async function deleteTicketCategory(id: number): Promise<void> {
  const pool = getPool();
  await pool.request().input('id', sql.Int, id).query(`
    DELETE FROM dbo.TicketCategories WHERE id = @id
  `);
}
