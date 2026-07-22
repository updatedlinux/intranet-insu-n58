import sql from 'mssql';
import { getPool } from '../config/database';
import type { DocumentLogAction } from '../constants/document-log-actions';

export interface DocumentLogInput {
  documentId: number;
  userId: number;
  action: DocumentLogAction;
  ipAddress?: string;
  userAgent?: string;
}

export async function insertDocumentLog(input: DocumentLogInput): Promise<void> {
  const pool = getPool();
  await pool
    .request()
    .input('documentId', sql.Int, input.documentId)
    .input('userId', sql.Int, input.userId)
    .input('action', sql.NVarChar(20), input.action)
    .input('ipAddress', sql.NVarChar(45), input.ipAddress ?? null)
    .input('userAgent', sql.NVarChar(500), input.userAgent ?? null).query(`
      INSERT INTO dbo.DocumentLogs (documentId, userId, action, ipAddress, userAgent)
      VALUES (@documentId, @userId, @action, @ipAddress, @userAgent)
    `);
}
