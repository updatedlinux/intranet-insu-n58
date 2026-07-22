import sql from 'mssql';
import { getPool } from '../config/database';
import type { ConsumableUnit } from '../constants/consumable-unit';
import type { StockMovementType } from '../constants/stock-movement-type';

export interface ConsumableRow {
  id: number;
  sku: string;
  name: string;
  brand: string | null;
  model: string | null;
  description: string | null;
  categoryId: number;
  categoryName: string;
  unit: ConsumableUnit;
  currentStock: number;
  minimumStock: number;
  location: string | null;
  imageKey: string | null;
  createdBy: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface StockMovementRow {
  id: number;
  consumableId: number;
  type: StockMovementType;
  quantity: number;
  previousStock: number;
  newStock: number;
  reason: string | null;
  relatedTicketId: number | null;
  relatedTicketCode: string | null;
  performedBy: number;
  performerFirstName: string;
  performerLastName: string;
  createdAt: Date;
  consumableName?: string;
  consumableSku?: string;
}

const CONSUMABLE_SELECT = `
  c.id, c.sku, c.name, c.brand, c.model, c.description,
  c.categoryId, cat.name AS categoryName, c.unit,
  c.currentStock, c.minimumStock, c.location, c.imageKey,
  c.createdBy, c.createdAt, c.updatedAt
`;

const CONSUMABLE_FROM = `
  FROM dbo.Consumables c
  INNER JOIN dbo.ConsumableCategories cat ON c.categoryId = cat.id
`;

export async function skuExists(sku: string, excludeId?: number): Promise<boolean> {
  const pool = getPool();
  const req = pool.request().input('sku', sql.NVarChar(100), sku.trim());
  let sqlText = `SELECT TOP 1 1 AS found FROM dbo.Consumables WHERE sku = @sku`;
  if (excludeId != null) {
    req.input('excludeId', sql.Int, excludeId);
    sqlText += ' AND id <> @excludeId';
  }
  const result = await req.query<{ found: number }>(sqlText);
  return (result.recordset[0]?.found ?? 0) > 0;
}

export async function createConsumable(input: Record<string, unknown>): Promise<number> {
  const pool = getPool();
  const result = await pool
    .request()
    .input('sku', sql.NVarChar(100), input.sku)
    .input('name', sql.NVarChar(300), input.name)
    .input('brand', sql.NVarChar(100), input.brand)
    .input('model', sql.NVarChar(100), input.model)
    .input('description', sql.NVarChar(sql.MAX), input.description)
    .input('categoryId', sql.Int, input.categoryId)
    .input('unit', sql.NVarChar(20), input.unit)
    .input('currentStock', sql.Int, input.currentStock ?? 0)
    .input('minimumStock', sql.Int, input.minimumStock ?? 0)
    .input('location', sql.NVarChar(200), input.location)
    .input('createdBy', sql.Int, input.createdBy).query<{ id: number }>(`
      INSERT INTO dbo.Consumables (
        sku, name, brand, model, description, categoryId, unit,
        currentStock, minimumStock, location, createdBy
      )
      OUTPUT INSERTED.id
      VALUES (
        @sku, @name, @brand, @model, @description, @categoryId, @unit,
        @currentStock, @minimumStock, @location, @createdBy
      )
    `);
  return result.recordset[0]!.id;
}

export async function findConsumableById(id: number): Promise<ConsumableRow | null> {
  const pool = getPool();
  const result = await pool.request().input('id', sql.Int, id).query<ConsumableRow>(`
    SELECT ${CONSUMABLE_SELECT} ${CONSUMABLE_FROM} WHERE c.id = @id
  `);
  return result.recordset[0] ?? null;
}

export async function listConsumables(filters: {
  categoryId?: number;
  lowStockOnly?: boolean;
  search?: string;
}): Promise<ConsumableRow[]> {
  const pool = getPool();
  const req = pool.request();
  const conditions = ['1 = 1'];

  if (filters.categoryId != null) {
    req.input('categoryId', sql.Int, filters.categoryId);
    conditions.push('c.categoryId = @categoryId');
  }
  if (filters.lowStockOnly) {
    conditions.push('c.currentStock <= c.minimumStock');
  }
  if (filters.search?.trim()) {
    req.input('search', sql.NVarChar(255), `%${filters.search.trim()}%`);
    conditions.push('(c.name LIKE @search OR c.sku LIKE @search)');
  }

  const result = await req.query<ConsumableRow>(`
    SELECT ${CONSUMABLE_SELECT} ${CONSUMABLE_FROM}
    WHERE ${conditions.join(' AND ')}
    ORDER BY c.name
  `);
  return result.recordset;
}

export async function listLowStockConsumables(): Promise<ConsumableRow[]> {
  return listConsumables({ lowStockOnly: true });
}

export async function updateConsumable(id: number, fields: Record<string, unknown>): Promise<void> {
  const sets: string[] = ['updatedAt = SYSUTCDATETIME()'];
  const pool = getPool();
  const req = pool.request().input('id', sql.Int, id);

  for (const key of [
    'sku',
    'name',
    'brand',
    'model',
    'description',
    'categoryId',
    'unit',
    'minimumStock',
    'location',
    'imageKey',
  ] as const) {
    if (fields[key] === undefined) continue;
    sets.push(`${key} = @${key}`);
    if (key === 'description') req.input(key, sql.NVarChar(sql.MAX), fields[key]);
    else if (key === 'imageKey') req.input(key, sql.NVarChar(500), fields[key]);
    else if (key === 'categoryId' || key === 'minimumStock') req.input(key, sql.Int, fields[key]);
    else req.input(key, sql.NVarChar(300), fields[key]);
  }

  await req.query(`UPDATE dbo.Consumables SET ${sets.join(', ')} WHERE id = @id`);
}

export async function applyStockMovement(input: {
  consumableId: number;
  type: StockMovementType;
  quantity: number;
  newStock: number;
  previousStock: number;
  reason: string | null;
  relatedTicketId: number | null;
  performedBy: number;
}): Promise<number> {
  const pool = getPool();
  const transaction = new sql.Transaction(pool);
  await transaction.begin();

  try {
    const updateReq = new sql.Request(transaction);
    await updateReq
      .input('id', sql.Int, input.consumableId)
      .input('newStock', sql.Int, input.newStock).query(`
        UPDATE dbo.Consumables
        SET currentStock = @newStock, updatedAt = SYSUTCDATETIME()
        WHERE id = @id
      `);

    const insertReq = new sql.Request(transaction);
    const result = await insertReq
      .input('consumableId', sql.Int, input.consumableId)
      .input('type', sql.NVarChar(20), input.type)
      .input('quantity', sql.Int, input.quantity)
      .input('previousStock', sql.Int, input.previousStock)
      .input('newStock', sql.Int, input.newStock)
      .input('reason', sql.NVarChar(500), input.reason)
      .input('relatedTicketId', sql.Int, input.relatedTicketId)
      .input('performedBy', sql.Int, input.performedBy).query<{ id: number }>(`
        INSERT INTO dbo.StockMovements (
          consumableId, type, quantity, previousStock, newStock,
          reason, relatedTicketId, performedBy
        )
        OUTPUT INSERTED.id
        VALUES (
          @consumableId, @type, @quantity, @previousStock, @newStock,
          @reason, @relatedTicketId, @performedBy
        )
      `);

    await transaction.commit();
    return result.recordset[0]!.id;
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

export async function listStockMovements(
  consumableId?: number,
  filters?: { ticketId?: number; sinceDays?: number },
): Promise<StockMovementRow[]> {
  const pool = getPool();
  const req = pool.request();
  const conditions = ['1 = 1'];

  if (consumableId != null) {
    req.input('consumableId', sql.Int, consumableId);
    conditions.push('m.consumableId = @consumableId');
  }
  if (filters?.ticketId != null) {
    req.input('ticketId', sql.Int, filters.ticketId);
    conditions.push('m.relatedTicketId = @ticketId');
  }
  if (filters?.sinceDays != null) {
    req.input('sinceDays', sql.Int, filters.sinceDays);
    conditions.push('m.createdAt >= DATEADD(day, -@sinceDays, SYSUTCDATETIME())');
  }

  const result = await req.query<StockMovementRow>(`
    SELECT m.id, m.consumableId, m.type, m.quantity, m.previousStock, m.newStock,
      m.reason, m.relatedTicketId, t.code AS relatedTicketCode,
      m.performedBy, u.firstName AS performerFirstName, u.lastName AS performerLastName,
      m.createdAt, c.name AS consumableName, c.sku AS consumableSku
    FROM dbo.StockMovements m
    INNER JOIN dbo.Users u ON m.performedBy = u.id
    INNER JOIN dbo.Consumables c ON m.consumableId = c.id
    LEFT JOIN dbo.Tickets t ON m.relatedTicketId = t.id
    WHERE ${conditions.join(' AND ')}
    ORDER BY m.createdAt DESC
  `);
  return result.recordset;
}

export async function listConsumableCategories(): Promise<{ id: number; name: string }[]> {
  const pool = getPool();
  const result = await pool.request().query<{ id: number; name: string }>(`
    SELECT id, name FROM dbo.ConsumableCategories ORDER BY name
  `);
  return result.recordset;
}

export async function hasStockAlertToday(): Promise<boolean> {
  const pool = getPool();
  const result = await pool.request().query<{ found: number }>(`
    SELECT TOP 1 1 AS found FROM dbo.InventoryStockAlertLog
    WHERE alertDate = CAST(SYSUTCDATETIME() AS DATE)
  `);
  return (result.recordset[0]?.found ?? 0) > 0;
}

export async function markStockAlertToday(): Promise<void> {
  const pool = getPool();
  await pool.request().query(`
    IF NOT EXISTS (
      SELECT 1 FROM dbo.InventoryStockAlertLog
      WHERE alertDate = CAST(SYSUTCDATETIME() AS DATE)
    )
    INSERT INTO dbo.InventoryStockAlertLog (alertDate) VALUES (CAST(SYSUTCDATETIME() AS DATE))
  `);
}
