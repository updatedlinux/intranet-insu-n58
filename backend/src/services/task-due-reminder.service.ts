import { NOTIFICATION_TYPES, NOTIFICATION_RESOURCE_TYPES } from '../constants/notification-type';
import { database } from '../config/database';
import { listTasksDueWithinHours } from '../repositories/task.repository';
import { notifyTaskDueSoon } from './task.service';
import { runWhenDatabaseReady } from '../utils/run-when-database-ready';
import sql from 'mssql';

const REMINDER_INTERVAL_MS = 60 * 60 * 1000;
const DUE_WITHIN_HOURS = 24;

let reminderInterval: ReturnType<typeof setInterval> | null = null;

async function hasRecentDueSoonNotification(taskId: number, userId: number): Promise<boolean> {
  const ready = await database.ensureConnected();
  if (!ready) {
    return true;
  }

  try {
    const pool = database.getPool();
    const result = await pool
      .request()
      .input('userId', sql.Int, userId)
      .input('type', sql.NVarChar(40), NOTIFICATION_TYPES.TASK_DUE_SOON)
      .input('resourceType', sql.NVarChar(40), NOTIFICATION_RESOURCE_TYPES.TASK)
      .input('resourceId', sql.Int, taskId).query<{ found: number }>(`
      SELECT TOP 1 1 AS found
      FROM dbo.Notifications
      WHERE userId = @userId AND type = @type
        AND resourceType = @resourceType AND resourceId = @resourceId
        AND createdAt >= DATEADD(hour, -20, SYSUTCDATETIME())
    `);
    return (result.recordset[0]?.found ?? 0) > 0;
  } catch (error) {
    if (database.isShuttingDown()) return true;
    throw error;
  }
}

async function runDueSoonReminders(): Promise<void> {
  const ready = await database.ensureConnected();
  if (!ready) return;

  const tasks = await listTasksDueWithinHours(DUE_WITHIN_HOURS);
  for (const task of tasks) {
    const assigneeIdsRaw = task.assigneeIds;
    const assigneeIds = assigneeIdsRaw
      ? assigneeIdsRaw
          .split(',')
          .map((id) => Number.parseInt(id, 10))
          .filter((id) => id > 0)
      : [task.createdBy];

    for (const assigneeId of assigneeIds) {
      const alreadySent = await hasRecentDueSoonNotification(task.id, assigneeId);
      if (alreadySent) continue;
      await notifyTaskDueSoon(task, assigneeId);
    }
  }
}

export function startTaskDueReminderScheduler(): void {
  stopTaskDueReminderScheduler();

  void runWhenDatabaseReady('tasks:vencimiento', runDueSoonReminders);
  reminderInterval = setInterval(() => {
    void runWhenDatabaseReady('tasks:vencimiento', runDueSoonReminders);
  }, REMINDER_INTERVAL_MS);

  console.log('[tasks] Recordatorio de vencimiento activo (cada hora)');
}

export function stopTaskDueReminderScheduler(): void {
  if (reminderInterval) {
    clearInterval(reminderInterval);
    reminderInterval = null;
  }
}
