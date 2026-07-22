import sql from 'mssql';
import { getPool } from '../config/database';
import type { CreateAuditLogInput } from '../types/audit';
import { sanitizeAuditDetail } from '../utils/audit-context';

function serializeDetail(detail: Record<string, unknown> | null | undefined): string | null {
  if (!detail || Object.keys(detail).length === 0) return null;
  const safe = sanitizeAuditDetail(detail);
  return JSON.stringify(safe).slice(0, 1000);
}

export async function insertAuditLog(input: CreateAuditLogInput): Promise<number> {
  const pool = getPool();
  const result = await pool
    .request()
    .input('action', sql.NVarChar(100), input.action)
    .input('actorUserId', sql.Int, input.actorUserId ?? null)
    .input('entityType', sql.NVarChar(50), input.entityType ?? null)
    .input('entityId', sql.Int, input.entityId ?? null)
    .input('detail', sql.NVarChar(1000), serializeDetail(input.detail))
    .input('ipAddress', sql.NVarChar(45), input.ipAddress ?? null)
    .input('userAgent', sql.NVarChar(500), input.userAgent ?? null).query<{ id: number }>(`
      INSERT INTO dbo.AuditLogs (
        action, actorUserId, entityType, entityId, detail, ipAddress, userAgent
      )
      OUTPUT INSERTED.id
      VALUES (
        @action, @actorUserId, @entityType, @entityId, @detail, @ipAddress, @userAgent
      )
    `);

  return result.recordset[0]!.id;
}
