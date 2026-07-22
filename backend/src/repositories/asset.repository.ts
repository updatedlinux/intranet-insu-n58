import sql from 'mssql';
import { getPool } from '../config/database';
import type { AssetCondition } from '../constants/asset-condition';
import type { AssetStatus } from '../constants/asset-status';
import type { MaintenanceType } from '../constants/maintenance-type';

export interface AssetRow {
  id: number;
  code: string;
  serial: string | null;
  sku: string | null;
  name: string;
  brand: string | null;
  model: string | null;
  description: string | null;
  categoryId: number;
  categoryName: string;
  status: AssetStatus;
  condition: AssetCondition;
  purchaseDate: Date | null;
  warrantyExpiry: Date | null;
  purchasePrice: number | null;
  location: string | null;
  assignedTo: number | null;
  assigneeFirstName: string | null;
  assigneeLastName: string | null;
  assignedAt: Date | null;
  notes: string | null;
  imageKey: string | null;
  createdBy: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface AssetAssignmentRow {
  id: number;
  assetId: number;
  userId: number;
  userFirstName: string;
  userLastName: string;
  assignedBy: number;
  assignerFirstName: string;
  assignerLastName: string;
  assignedAt: Date;
  returnedAt: Date | null;
  notes: string | null;
}

export interface AssetMaintenanceRow {
  id: number;
  assetId: number;
  performedBy: number;
  performerFirstName: string;
  performerLastName: string;
  type: MaintenanceType;
  description: string;
  cost: number | null;
  performedAt: Date;
  nextMaintenanceAt: Date | null;
  relatedTicketId: number | null;
  relatedTicketCode: string | null;
  createdAt: Date;
}

const ASSET_SELECT = `
  a.id, a.code, a.serial, a.sku, a.name, a.brand, a.model, a.description,
  a.categoryId, c.name AS categoryName, a.status, a.condition,
  a.purchaseDate, a.warrantyExpiry, a.purchasePrice, a.location,
  a.assignedTo, u.firstName AS assigneeFirstName, u.lastName AS assigneeLastName,
  a.assignedAt, a.notes, a.imageKey, a.createdBy, a.createdAt, a.updatedAt
`;

const ASSET_FROM = `
  FROM dbo.Assets a
  INNER JOIN dbo.AssetCategories c ON a.categoryId = c.id
  LEFT JOIN dbo.Users u ON a.assignedTo = u.id
`;

export async function allocateAssetCode(): Promise<string> {
  const pool = getPool();
  const result = await pool.request().query<{ nextNum: number }>(`
    SELECT ISNULL(MAX(TRY_CAST(SUBSTRING(code, 5, 20) AS INT)), 0) + 1 AS nextNum
    FROM dbo.Assets WHERE code LIKE N'ACT-%'
  `);
  const nextNum = result.recordset[0]?.nextNum ?? 1;
  return `ACT-${String(nextNum).padStart(4, '0')}`;
}

export async function serialExists(serial: string, excludeId?: number): Promise<boolean> {
  const pool = getPool();
  const req = pool.request().input('serial', sql.NVarChar(100), serial.trim());
  let sqlText = `SELECT TOP 1 1 AS found FROM dbo.Assets WHERE serial = @serial`;
  if (excludeId != null) {
    req.input('excludeId', sql.Int, excludeId);
    sqlText += ' AND id <> @excludeId';
  }
  const result = await req.query<{ found: number }>(sqlText);
  return (result.recordset[0]?.found ?? 0) > 0;
}

export async function createAsset(input: Record<string, unknown>): Promise<number> {
  const pool = getPool();
  const result = await pool
    .request()
    .input('code', sql.NVarChar(20), input.code)
    .input('serial', sql.NVarChar(100), input.serial)
    .input('sku', sql.NVarChar(100), input.sku)
    .input('name', sql.NVarChar(300), input.name)
    .input('brand', sql.NVarChar(100), input.brand)
    .input('model', sql.NVarChar(100), input.model)
    .input('description', sql.NVarChar(sql.MAX), input.description)
    .input('categoryId', sql.Int, input.categoryId)
    .input('status', sql.NVarChar(20), input.status)
    .input('condition', sql.NVarChar(20), input.condition)
    .input('purchaseDate', sql.Date, input.purchaseDate)
    .input('warrantyExpiry', sql.Date, input.warrantyExpiry)
    .input('purchasePrice', sql.Decimal(18, 2), input.purchasePrice)
    .input('location', sql.NVarChar(200), input.location)
    .input('notes', sql.NVarChar(sql.MAX), input.notes)
    .input('createdBy', sql.Int, input.createdBy).query<{ id: number }>(`
      INSERT INTO dbo.Assets (
        code, serial, sku, name, brand, model, description, categoryId,
        status, condition, purchaseDate, warrantyExpiry, purchasePrice,
        location, notes, createdBy
      )
      OUTPUT INSERTED.id
      VALUES (
        @code, @serial, @sku, @name, @brand, @model, @description, @categoryId,
        @status, @condition, @purchaseDate, @warrantyExpiry, @purchasePrice,
        @location, @notes, @createdBy
      )
    `);
  return result.recordset[0]!.id;
}

export async function findAssetById(id: number): Promise<AssetRow | null> {
  const pool = getPool();
  const result = await pool.request().input('id', sql.Int, id).query<AssetRow>(`
    SELECT ${ASSET_SELECT} ${ASSET_FROM} WHERE a.id = @id
  `);
  return result.recordset[0] ?? null;
}

export async function listAssets(filters: {
  categoryId?: number;
  status?: AssetStatus;
  assignedTo?: number;
  unassignedOnly?: boolean;
  search?: string;
  purchaseDateFrom?: string;
  purchaseDateTo?: string;
  createdFrom?: Date;
  createdTo?: Date;
  assignedFrom?: Date;
  assignedToDate?: Date;
}): Promise<AssetRow[]> {
  const pool = getPool();
  const req = pool.request();
  const conditions = ['1 = 1'];

  if (filters.categoryId != null) {
    req.input('categoryId', sql.Int, filters.categoryId);
    conditions.push('a.categoryId = @categoryId');
  }
  if (filters.status != null) {
    req.input('status', sql.NVarChar(20), filters.status);
    conditions.push('a.status = @status');
  }
  if (filters.assignedTo != null) {
    req.input('assignedTo', sql.Int, filters.assignedTo);
    conditions.push('a.assignedTo = @assignedTo');
  }
  if (filters.unassignedOnly) {
    conditions.push('a.assignedTo IS NULL');
  }
  if (filters.search?.trim()) {
    req.input('search', sql.NVarChar(255), `%${filters.search.trim()}%`);
    conditions.push(`(
      a.name LIKE @search OR a.code LIKE @search
      OR a.serial LIKE @search OR a.sku LIKE @search
    )`);
  }
  if (filters.purchaseDateFrom) {
    req.input('purchaseDateFrom', sql.Date, filters.purchaseDateFrom);
    conditions.push('a.purchaseDate >= @purchaseDateFrom');
  }
  if (filters.purchaseDateTo) {
    req.input('purchaseDateTo', sql.Date, filters.purchaseDateTo);
    conditions.push('a.purchaseDate <= @purchaseDateTo');
  }
  if (filters.createdFrom) {
    req.input('createdFrom', sql.DateTime2, filters.createdFrom);
    conditions.push('a.createdAt >= @createdFrom');
  }
  if (filters.createdTo) {
    req.input('createdTo', sql.DateTime2, filters.createdTo);
    conditions.push('a.createdAt <= @createdTo');
  }
  if (filters.assignedFrom) {
    req.input('assignedFrom', sql.DateTime2, filters.assignedFrom);
    conditions.push('a.assignedAt >= @assignedFrom');
  }
  if (filters.assignedToDate) {
    req.input('assignedToDate', sql.DateTime2, filters.assignedToDate);
    conditions.push('a.assignedAt <= @assignedToDate');
  }

  const result = await req.query<AssetRow>(`
    SELECT ${ASSET_SELECT} ${ASSET_FROM}
    WHERE ${conditions.join(' AND ')}
    ORDER BY a.updatedAt DESC, a.id DESC
  `);
  return result.recordset;
}

export async function listAssetsByUserId(userId: number): Promise<AssetRow[]> {
  return listAssets({ assignedTo: userId });
}

export async function updateAsset(id: number, fields: Record<string, unknown>): Promise<void> {
  const sets: string[] = ['updatedAt = SYSUTCDATETIME()'];
  const pool = getPool();
  const req = pool.request().input('id', sql.Int, id);

  const map: [string, string, unknown][] = [
    ['serial', 'NVarChar', fields.serial],
    ['sku', 'NVarChar', fields.sku],
    ['name', 'NVarChar', fields.name],
    ['brand', 'NVarChar', fields.brand],
    ['model', 'NVarChar', fields.model],
    ['description', 'NVarCharMax', fields.description],
    ['categoryId', 'Int', fields.categoryId],
    ['status', 'NVarChar', fields.status],
    ['condition', 'NVarChar', fields.condition],
    ['purchaseDate', 'Date', fields.purchaseDate],
    ['warrantyExpiry', 'Date', fields.warrantyExpiry],
    ['purchasePrice', 'Decimal', fields.purchasePrice],
    ['location', 'NVarChar', fields.location],
    ['notes', 'NVarCharMax', fields.notes],
    ['assignedTo', 'Int', fields.assignedTo],
    ['assignedAt', 'DateTime2', fields.assignedAt],
    ['imageKey', 'NVarChar500', fields.imageKey],
  ];

  for (const [key, type, value] of map) {
    if (value === undefined) continue;
    sets.push(`${key} = @${key}`);
    if (type === 'NVarCharMax') req.input(key, sql.NVarChar(sql.MAX), value);
    else if (type === 'NVarChar500') req.input(key, sql.NVarChar(500), value);
    else if (type === 'Decimal') req.input(key, sql.Decimal(18, 2), value);
    else if (type === 'Int') req.input(key, sql.Int, value);
    else if (type === 'Date') req.input(key, sql.Date, value);
    else if (type === 'DateTime2') req.input(key, sql.DateTime2, value);
    else req.input(key, sql.NVarChar(200), value);
  }

  await req.query(`UPDATE dbo.Assets SET ${sets.join(', ')} WHERE id = @id`);
}

export async function openAssignment(input: {
  assetId: number;
  userId: number;
  assignedBy: number;
  notes: string | null;
}): Promise<number> {
  const pool = getPool();
  const result = await pool
    .request()
    .input('assetId', sql.Int, input.assetId)
    .input('userId', sql.Int, input.userId)
    .input('assignedBy', sql.Int, input.assignedBy)
    .input('notes', sql.NVarChar(500), input.notes).query<{ id: number }>(`
      INSERT INTO dbo.AssetAssignmentHistory (assetId, userId, assignedBy, notes)
      OUTPUT INSERTED.id VALUES (@assetId, @userId, @assignedBy, @notes)
    `);
  return result.recordset[0]!.id;
}

export async function closeOpenAssignment(assetId: number, returnedAt: Date): Promise<void> {
  const pool = getPool();
  await pool
    .request()
    .input('assetId', sql.Int, assetId)
    .input('returnedAt', sql.DateTime2, returnedAt).query(`
      UPDATE dbo.AssetAssignmentHistory
      SET returnedAt = @returnedAt
      WHERE assetId = @assetId AND returnedAt IS NULL
    `);
}

export async function listAssignmentHistory(assetId: number): Promise<AssetAssignmentRow[]> {
  const pool = getPool();
  const result = await pool.request().input('assetId', sql.Int, assetId).query<AssetAssignmentRow>(`
    SELECT h.id, h.assetId, h.userId, u.firstName AS userFirstName, u.lastName AS userLastName,
      h.assignedBy, ab.firstName AS assignerFirstName, ab.lastName AS assignerLastName,
      h.assignedAt, h.returnedAt, h.notes
    FROM dbo.AssetAssignmentHistory h
    INNER JOIN dbo.Users u ON h.userId = u.id
    INNER JOIN dbo.Users ab ON h.assignedBy = ab.id
    WHERE h.assetId = @assetId
    ORDER BY h.assignedAt DESC
  `);
  return result.recordset;
}

export async function createMaintenance(input: Record<string, unknown>): Promise<number> {
  const pool = getPool();
  const result = await pool
    .request()
    .input('assetId', sql.Int, input.assetId)
    .input('performedBy', sql.Int, input.performedBy)
    .input('type', sql.NVarChar(20), input.type)
    .input('description', sql.NVarChar(sql.MAX), input.description)
    .input('cost', sql.Decimal(18, 2), input.cost)
    .input('performedAt', sql.DateTime2, input.performedAt)
    .input('nextMaintenanceAt', sql.DateTime2, input.nextMaintenanceAt)
    .input('relatedTicketId', sql.Int, input.relatedTicketId).query<{ id: number }>(`
      INSERT INTO dbo.AssetMaintenanceLogs (
        assetId, performedBy, type, description, cost, performedAt,
        nextMaintenanceAt, relatedTicketId
      )
      OUTPUT INSERTED.id
      VALUES (
        @assetId, @performedBy, @type, @description, @cost, @performedAt,
        @nextMaintenanceAt, @relatedTicketId
      )
    `);
  return result.recordset[0]!.id;
}

export async function listMaintenanceLogs(assetId: number): Promise<AssetMaintenanceRow[]> {
  const pool = getPool();
  const result = await pool.request().input('assetId', sql.Int, assetId)
    .query<AssetMaintenanceRow>(`
    SELECT m.id, m.assetId, m.performedBy, u.firstName AS performerFirstName,
      u.lastName AS performerLastName, m.type, m.description, m.cost, m.performedAt,
      m.nextMaintenanceAt, m.relatedTicketId, t.code AS relatedTicketCode, m.createdAt
    FROM dbo.AssetMaintenanceLogs m
    INNER JOIN dbo.Users u ON m.performedBy = u.id
    LEFT JOIN dbo.Tickets t ON m.relatedTicketId = t.id
    WHERE m.assetId = @assetId
    ORDER BY m.performedAt DESC
  `);
  return result.recordset;
}

export async function listAssetCategories(): Promise<{ id: number; name: string }[]> {
  const pool = getPool();
  const result = await pool.request().query<{ id: number; name: string }>(`
    SELECT id, name FROM dbo.AssetCategories ORDER BY name
  `);
  return result.recordset;
}

export async function getInventoryDashboardStats(): Promise<{
  totalAssets: number;
  assignedAssets: number;
  maintenanceAssets: number;
  lowStockConsumables: number;
}> {
  const pool = getPool();
  const result = await pool.request().query<{
    totalAssets: number;
    assignedAssets: number;
    maintenanceAssets: number;
    lowStockConsumables: number;
  }>(`
    SELECT
      (SELECT COUNT(*) FROM dbo.Assets) AS totalAssets,
      (SELECT COUNT(*) FROM dbo.Assets WHERE assignedTo IS NOT NULL AND status = N'ACTIVE') AS assignedAssets,
      (SELECT COUNT(*) FROM dbo.Assets WHERE status = N'IN_MAINTENANCE') AS maintenanceAssets,
      (SELECT COUNT(*) FROM dbo.Consumables WHERE currentStock <= minimumStock) AS lowStockConsumables
  `);
  return (
    result.recordset[0] ?? {
      totalAssets: 0,
      assignedAssets: 0,
      maintenanceAssets: 0,
      lowStockConsumables: 0,
    }
  );
}

export async function listAssetsWarrantyExpiringSoon(days = 30): Promise<AssetRow[]> {
  const pool = getPool();
  const result = await pool.request().input('days', sql.Int, days).query<AssetRow>(`
    SELECT ${ASSET_SELECT} ${ASSET_FROM}
    WHERE a.warrantyExpiry IS NOT NULL
      AND a.warrantyExpiry <= DATEADD(day, @days, CAST(SYSUTCDATETIME() AS DATE))
      AND a.warrantyExpiry >= CAST(SYSUTCDATETIME() AS DATE)
      AND a.status NOT IN (N'RETIRED', N'LOST', N'STOLEN')
    ORDER BY a.warrantyExpiry
  `);
  return result.recordset;
}

export async function listAssetsGroupedByAssignee(): Promise<
  { userId: number; userName: string; assetCount: number }[]
> {
  const pool = getPool();
  const result = await pool.request().query<{
    userId: number;
    userName: string;
    assetCount: number;
  }>(`
    SELECT u.id AS userId,
      CONCAT(u.firstName, N' ', u.lastName) AS userName,
      COUNT(*) AS assetCount
    FROM dbo.Assets a
    INNER JOIN dbo.Users u ON a.assignedTo = u.id
    WHERE a.assignedTo IS NOT NULL
    GROUP BY u.id, u.firstName, u.lastName
    ORDER BY userName
  `);
  return result.recordset;
}
