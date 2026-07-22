import cron, { type ScheduledTask } from 'node-cron';
import { runWhenDatabaseReady } from '../utils/run-when-database-ready';

const registries = new Map<string, ScheduledTask[]>();

export function registerCronJob(
  registryId: string,
  cronExpression: string,
  logLabel: string,
  job: () => Promise<void>,
  options?: { runOnStart?: boolean },
): ScheduledTask {
  const tasks = registries.get(registryId) ?? [];

  const task = cron.schedule(cronExpression, () => {
    void runWhenDatabaseReady(logLabel, job);
  });
  tasks.push(task);
  registries.set(registryId, tasks);

  if (options?.runOnStart) {
    void runWhenDatabaseReady(logLabel, job);
  }

  return task;
}

export function stopCronJobs(registryId: string): void {
  const tasks = registries.get(registryId) ?? [];
  for (const task of tasks) {
    void task.stop();
    if (typeof (task as { destroy?: () => void }).destroy === 'function') {
      (task as { destroy: () => void }).destroy();
    }
  }
  registries.delete(registryId);
}

export function stopAllCronJobs(): void {
  for (const registryId of [...registries.keys()]) {
    stopCronJobs(registryId);
  }
}
