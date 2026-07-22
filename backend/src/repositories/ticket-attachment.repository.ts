import sql from 'mssql';
import { getPool } from '../config/database';

export interface TicketAttachmentRow {
  id: number;
  ticketId: number;
  fileName: string;
  fileKey: string;
  fileSize: number;
  mimeType: string;
  createdAt: Date;
}

export async function insertTicketAttachment(input: {
  ticketId: number;
  fileName: string;
  fileKey: string;
  fileSize: number;
  mimeType: string;
}): Promise<number> {
  const pool = getPool();
  const result = await pool
    .request()
    .input('ticketId', sql.Int, input.ticketId)
    .input('fileName', sql.NVarChar(255), input.fileName)
    .input('fileKey', sql.NVarChar(500), input.fileKey)
    .input('fileSize', sql.BigInt, input.fileSize)
    .input('mimeType', sql.NVarChar(100), input.mimeType).query<{ id: number }>(`
      INSERT INTO dbo.TicketAttachments (ticketId, fileName, fileKey, fileSize, mimeType)
      OUTPUT INSERTED.id
      VALUES (@ticketId, @fileName, @fileKey, @fileSize, @mimeType)
    `);
  return result.recordset[0]!.id;
}

export async function listTicketAttachmentsByTicketId(
  ticketId: number,
): Promise<TicketAttachmentRow[]> {
  const pool = getPool();
  const result = await pool.request().input('ticketId', sql.Int, ticketId)
    .query<TicketAttachmentRow>(`
      SELECT id, ticketId, fileName, fileKey, fileSize, mimeType, createdAt
      FROM dbo.TicketAttachments
      WHERE ticketId = @ticketId
      ORDER BY createdAt ASC, id ASC
    `);
  return result.recordset;
}

export async function findTicketAttachmentById(
  attachmentId: number,
): Promise<TicketAttachmentRow | null> {
  const pool = getPool();
  const result = await pool.request().input('id', sql.Int, attachmentId)
    .query<TicketAttachmentRow>(`
      SELECT id, ticketId, fileName, fileKey, fileSize, mimeType, createdAt
      FROM dbo.TicketAttachments
      WHERE id = @id
    `);
  return result.recordset[0] ?? null;
}
