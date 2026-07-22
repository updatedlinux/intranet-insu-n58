import sql from 'mssql';
import { getPool } from '../config/database';

export interface AssetCategoryRow {
  id: number;
  name: string;
  description: string | null;
  itemCount: number;
  createdAt: Date;
}

export interface ConsumableCategoryRow {
  id: number;
  name: string;
  description: string | null;
  itemCount: number;
  createdAt: Date;
}

export async function listAssetCategoriesAdmin(name?: string): Promise<AssetCategoryRow[]> {
  const pool = getPool();
  const req = pool.request();
  const conditions = ['1 = 1'];
  if (name?.trim()) {
    req.input('name', sql.NVarChar(255), `%${name.trim()}%`);
    conditions.push('c.name LIKE @name');
  }
  const result = await req.query<AssetCategoryRow>(`
    SELECT c.id, c.name, c.description, c.createdAt,
      (SELECT COUNT(*) FROM dbo.Assets a WHERE a.categoryId = c.id) AS itemCount
    FROM dbo.AssetCategories c
    WHERE ${conditions.join(' AND ')}
    ORDER BY c.name
  `);
  return result.recordset;
}

export async function findAssetCategoryById(id: number): Promise<AssetCategoryRow | null> {
  const pool = getPool();
  const result = await pool.request().input('id', sql.Int, id).query<AssetCategoryRow>(`
    SELECT c.id, c.name, c.description, c.createdAt,
      (SELECT COUNT(*) FROM dbo.Assets a WHERE a.categoryId = c.id) AS itemCount
    FROM dbo.AssetCategories c
    WHERE c.id = @id
  `);
  return result.recordset[0] ?? null;
}

export async function assetCategoryNameExists(name: string, excludeId?: number): Promise<boolean> {
  const pool = getPool();
  const req = pool.request().input('name', sql.NVarChar(100), name.trim().toLowerCase());
  let q = `SELECT TOP 1 1 AS found FROM dbo.AssetCategories WHERE LOWER(LTRIM(RTRIM(name))) = @name`;
  if (excludeId != null) {
    req.input('excludeId', sql.Int, excludeId);
    q += ' AND id <> @excludeId';
  }
  const result = await req.query<{ found: number }>(q);
  return (result.recordset[0]?.found ?? 0) > 0;
}

export async function createAssetCategory(input: {
  name: string;
  description: string | null;
}): Promise<number> {
  const pool = getPool();
  const result = await pool
    .request()
    .input('name', sql.NVarChar(100), input.name.trim())
    .input('description', sql.NVarChar(500), input.description).query<{ id: number }>(`
      INSERT INTO dbo.AssetCategories (name, description, icon)
      OUTPUT INSERTED.id
      VALUES (@name, @description, NULL)
    `);
  return result.recordset[0]!.id;
}

export async function updateAssetCategory(
  id: number,
  input: { name: string; description: string | null },
): Promise<void> {
  const pool = getPool();
  await pool
    .request()
    .input('id', sql.Int, id)
    .input('name', sql.NVarChar(100), input.name.trim())
    .input('description', sql.NVarChar(500), input.description).query(`
      UPDATE dbo.AssetCategories
      SET name = @name, description = @description
      WHERE id = @id
    `);
}

export async function deleteAssetCategory(id: number): Promise<void> {
  const pool = getPool();
  await pool
    .request()
    .input('id', sql.Int, id)
    .query(`DELETE FROM dbo.AssetCategories WHERE id = @id`);
}

export async function listConsumableCategoriesAdmin(
  name?: string,
): Promise<ConsumableCategoryRow[]> {
  const pool = getPool();
  const req = pool.request();
  const conditions = ['1 = 1'];
  if (name?.trim()) {
    req.input('name', sql.NVarChar(255), `%${name.trim()}%`);
    conditions.push('c.name LIKE @name');
  }
  const result = await req.query<ConsumableCategoryRow>(`
    SELECT c.id, c.name, c.description, c.createdAt,
      (SELECT COUNT(*) FROM dbo.Consumables x WHERE x.categoryId = c.id) AS itemCount
    FROM dbo.ConsumableCategories c
    WHERE ${conditions.join(' AND ')}
    ORDER BY c.name
  `);
  return result.recordset;
}

export async function findConsumableCategoryById(
  id: number,
): Promise<ConsumableCategoryRow | null> {
  const pool = getPool();
  const result = await pool.request().input('id', sql.Int, id).query<ConsumableCategoryRow>(`
    SELECT c.id, c.name, c.description, c.createdAt,
      (SELECT COUNT(*) FROM dbo.Consumables x WHERE x.categoryId = c.id) AS itemCount
    FROM dbo.ConsumableCategories c
    WHERE c.id = @id
  `);
  return result.recordset[0] ?? null;
}

export async function consumableCategoryNameExists(
  name: string,
  excludeId?: number,
): Promise<boolean> {
  const pool = getPool();
  const req = pool.request().input('name', sql.NVarChar(100), name.trim().toLowerCase());
  let q = `SELECT TOP 1 1 AS found FROM dbo.ConsumableCategories WHERE LOWER(LTRIM(RTRIM(name))) = @name`;
  if (excludeId != null) {
    req.input('excludeId', sql.Int, excludeId);
    q += ' AND id <> @excludeId';
  }
  const result = await req.query<{ found: number }>(q);
  return (result.recordset[0]?.found ?? 0) > 0;
}

export async function createConsumableCategory(input: {
  name: string;
  description: string | null;
}): Promise<number> {
  const pool = getPool();
  const result = await pool
    .request()
    .input('name', sql.NVarChar(100), input.name.trim())
    .input('description', sql.NVarChar(500), input.description).query<{ id: number }>(`
      INSERT INTO dbo.ConsumableCategories (name, description)
      OUTPUT INSERTED.id
      VALUES (@name, @description)
    `);
  return result.recordset[0]!.id;
}

export async function updateConsumableCategory(
  id: number,
  input: { name: string; description: string | null },
): Promise<void> {
  const pool = getPool();
  await pool
    .request()
    .input('id', sql.Int, id)
    .input('name', sql.NVarChar(100), input.name.trim())
    .input('description', sql.NVarChar(500), input.description).query(`
      UPDATE dbo.ConsumableCategories
      SET name = @name, description = @description
      WHERE id = @id
    `);
}

export async function deleteConsumableCategory(id: number): Promise<void> {
  const pool = getPool();
  await pool
    .request()
    .input('id', sql.Int, id)
    .query(`DELETE FROM dbo.ConsumableCategories WHERE id = @id`);
}
