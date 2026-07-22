export interface AuditContext {
  ipAddress?: string;
  userAgent?: string;
}

export interface AuditLogRecord {
  id: number;
  action: string;
  actorUserId: number | null;
  entityType: string | null;
  entityId: number | null;
  detail: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
}

export interface CreateAuditLogInput {
  action: string;
  actorUserId?: number | null;
  entityType?: string | null;
  entityId?: number | null;
  detail?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}
