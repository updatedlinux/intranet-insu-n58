import sql from 'mssql';
import { getPool } from '../config/database';
import type { TaskStatus } from '../constants/task-status';

export interface BoardRow {
  id: number;
  areaId: number;
  areaName: string;
  name: string;
  createdAt: Date;
}

export interface BoardColumnRow {
  id: number;
  boardId: number;
  name: string;
  order: number;
  color: string | null;
  defaultStatus: TaskStatus;
  createdAt: Date;
}

export async function findBoardById(boardId: number): Promise<BoardRow | null> {
  const pool = getPool();
  const result = await pool.request().input('id', sql.Int, boardId).query<BoardRow>(`
    SELECT b.id, b.areaId, a.name AS areaName, b.name, b.createdAt
    FROM dbo.Boards b
    INNER JOIN dbo.Areas a ON b.areaId = a.id
    WHERE b.id = @id
  `);
  return result.recordset[0] ?? null;
}

export async function findBoardByAreaId(areaId: number): Promise<BoardRow | null> {
  const pool = getPool();
  const result = await pool.request().input('areaId', sql.Int, areaId).query<BoardRow>(`
    SELECT b.id, b.areaId, a.name AS areaName, b.name, b.createdAt
    FROM dbo.Boards b
    INNER JOIN dbo.Areas a ON b.areaId = a.id
    WHERE b.areaId = @areaId
  `);
  return result.recordset[0] ?? null;
}

export async function listAllBoards(): Promise<BoardRow[]> {
  const pool = getPool();
  const result = await pool.request().query<BoardRow>(`
    SELECT b.id, b.areaId, a.name AS areaName, b.name, b.createdAt
    FROM dbo.Boards b
    INNER JOIN dbo.Areas a ON b.areaId = a.id
    ORDER BY a.name
  `);
  return result.recordset;
}

export async function listBoardsByAreaIds(areaIds: number[]): Promise<BoardRow[]> {
  if (areaIds.length === 0) return [];
  const pool = getPool();
  const request = pool.request();
  const placeholders = areaIds.map((id, i) => {
    request.input(`area${i}`, sql.Int, id);
    return `@area${i}`;
  });
  const result = await request.query<BoardRow>(`
    SELECT b.id, b.areaId, a.name AS areaName, b.name, b.createdAt
    FROM dbo.Boards b
    INNER JOIN dbo.Areas a ON b.areaId = a.id
    WHERE b.areaId IN (${placeholders.join(', ')})
    ORDER BY a.name
  `);
  return result.recordset;
}

export async function createBoardForArea(areaId: number, areaName: string): Promise<number> {
  const pool = getPool();
  const result = await pool
    .request()
    .input('areaId', sql.Int, areaId)
    .input('name', sql.NVarChar(200), `Tablero ${areaName}`).query<{ id: number }>(`
      INSERT INTO dbo.Boards (areaId, name)
      OUTPUT INSERTED.id
      VALUES (@areaId, @name)
    `);
  const boardId = result.recordset[0]!.id;

  const defaults = [
    { name: 'Por Hacer', order: 0, color: '#64748b', status: 'OPEN' },
    { name: 'En Progreso', order: 1, color: '#0369a1', status: 'IN_PROGRESS' },
    { name: 'En Revisión', order: 2, color: '#b45309', status: 'IN_REVIEW' },
    { name: 'Completado', order: 3, color: '#15803d', status: 'DONE' },
  ];

  for (const col of defaults) {
    await pool
      .request()
      .input('boardId', sql.Int, boardId)
      .input('name', sql.NVarChar(100), col.name)
      .input('order', sql.Int, col.order)
      .input('color', sql.NVarChar(7), col.color)
      .input('defaultStatus', sql.NVarChar(20), col.status).query(`
        INSERT INTO dbo.BoardColumns (boardId, name, [order], color, defaultStatus)
        VALUES (@boardId, @name, @order, @color, @defaultStatus)
      `);
  }

  return boardId;
}

export async function updateBoardNameForArea(areaId: number, areaName: string): Promise<void> {
  const pool = getPool();
  await pool
    .request()
    .input('areaId', sql.Int, areaId)
    .input('name', sql.NVarChar(200), `Tablero ${areaName}`).query(`
      UPDATE dbo.Boards
      SET name = @name
      WHERE areaId = @areaId
    `);
}

export async function ensureBoardForArea(areaId: number, areaName: string): Promise<number> {
  const existing = await findBoardByAreaId(areaId);
  if (existing) {
    await updateBoardNameForArea(areaId, areaName);
    return existing.id;
  }
  return createBoardForArea(areaId, areaName);
}

export async function listColumnsByBoardId(boardId: number): Promise<BoardColumnRow[]> {
  const pool = getPool();
  const result = await pool.request().input('boardId', sql.Int, boardId).query<BoardColumnRow>(`
    SELECT id, boardId, name, [order], color, defaultStatus, createdAt
    FROM dbo.BoardColumns
    WHERE boardId = @boardId
    ORDER BY [order]
  `);
  return result.recordset;
}

export async function findColumnById(columnId: number): Promise<BoardColumnRow | null> {
  const pool = getPool();
  const result = await pool.request().input('id', sql.Int, columnId).query<BoardColumnRow>(`
    SELECT id, boardId, name, [order], color, defaultStatus, createdAt
    FROM dbo.BoardColumns WHERE id = @id
  `);
  return result.recordset[0] ?? null;
}

export async function countTasksInColumn(columnId: number): Promise<number> {
  const pool = getPool();
  const result = await pool.request().input('columnId', sql.Int, columnId).query<{
    total: number;
  }>(`
    SELECT COUNT(*) AS total FROM dbo.Tasks
    WHERE columnId = @columnId AND archivedAt IS NULL
  `);
  return result.recordset[0]?.total ?? 0;
}

export async function insertBoardColumn(
  boardId: number,
  name: string,
  order: number,
  color: string | null,
  defaultStatus: TaskStatus,
): Promise<number> {
  const pool = getPool();
  const result = await pool
    .request()
    .input('boardId', sql.Int, boardId)
    .input('name', sql.NVarChar(100), name)
    .input('order', sql.Int, order)
    .input('color', sql.NVarChar(7), color)
    .input('defaultStatus', sql.NVarChar(20), defaultStatus).query<{ id: number }>(`
      INSERT INTO dbo.BoardColumns (boardId, name, [order], color, defaultStatus)
      OUTPUT INSERTED.id
      VALUES (@boardId, @name, @order, @color, @defaultStatus)
    `);
  return result.recordset[0]!.id;
}

export async function updateBoardColumn(
  columnId: number,
  data: { name?: string; color?: string | null },
): Promise<void> {
  const pool = getPool();
  const sets: string[] = [];
  const request = pool.request().input('id', sql.Int, columnId);
  if (data.name != null) {
    request.input('name', sql.NVarChar(100), data.name);
    sets.push('name = @name');
  }
  if (data.color !== undefined) {
    request.input('color', sql.NVarChar(7), data.color);
    sets.push('color = @color');
  }
  if (sets.length === 0) return;
  await request.query(`UPDATE dbo.BoardColumns SET ${sets.join(', ')} WHERE id = @id`);
}

export async function reorderBoardColumns(
  boardId: number,
  columnOrders: { columnId: number; order: number }[],
): Promise<void> {
  const pool = getPool();
  for (const item of columnOrders) {
    await pool
      .request()
      .input('boardId', sql.Int, boardId)
      .input('columnId', sql.Int, item.columnId)
      .input('order', sql.Int, item.order).query(`
        UPDATE dbo.BoardColumns SET [order] = @order
        WHERE id = @columnId AND boardId = @boardId
      `);
  }
}

export async function deleteBoardColumn(columnId: number): Promise<void> {
  const pool = getPool();
  await pool.request().input('id', sql.Int, columnId).query(`
    DELETE FROM dbo.BoardColumns WHERE id = @id
  `);
}

export async function getMaxColumnOrder(boardId: number): Promise<number> {
  const pool = getPool();
  const result = await pool.request().input('boardId', sql.Int, boardId).query<{
    maxOrder: number | null;
  }>(`
    SELECT MAX([order]) AS maxOrder FROM dbo.BoardColumns WHERE boardId = @boardId
  `);
  return result.recordset[0]?.maxOrder ?? -1;
}
