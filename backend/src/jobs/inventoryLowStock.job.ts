import { NOTIFICATION_RESOURCE_TYPES, NOTIFICATION_TYPES } from '../constants/notification-type';
import {
  hasStockAlertToday,
  listLowStockConsumables,
  markStockAlertToday,
} from '../repositories/consumable.repository';
import { listItTeamUserIds } from '../repositories/ticket.repository';
import { createNotificationsForUsers } from '../services/notification.service';
import { displayName, emailService, notifyEmail } from '../services/email.service';
import { registerCronJob, stopCronJobs } from './cron-registry';

const INVENTORY_CRON_REGISTRY = 'inventory';

async function runLowStockAlertJob(): Promise<void> {
  if (await hasStockAlertToday()) return;

  const items = await listLowStockConsumables();
  if (items.length === 0) return;

  const team = await listItTeamUserIds();
  if (team.length === 0) return;

  const userIds = team.map((u) => u.id);
  const title = 'Stock crítico en inventario TI';
  const message =
    items.length === 1
      ? `1 consumible bajo stock mínimo: ${items[0]!.name}`
      : `${items.length} consumibles bajo stock mínimo`;

  await createNotificationsForUsers(
    userIds,
    NOTIFICATION_TYPES.INVENTORY_LOW_STOCK,
    title,
    message,
    NOTIFICATION_RESOURCE_TYPES.INVENTORY,
    null,
  );

  const listHtml = items
    .map(
      (c) =>
        `<li><strong>${c.sku}</strong> — ${c.name}: ${c.currentStock} / mín. ${c.minimumStock}</li>`,
    )
    .join('');

  for (const member of team) {
    notifyEmail(
      () =>
        emailService.sendInventoryLowStockAlert(
          member.email,
          displayName(member.firstName, member.lastName),
          items.length,
          listHtml,
        ),
      `inventory-low-stock ${member.email}`,
    );
  }

  await markStockAlertToday();
  console.log(`[inventory] Alerta stock crítico enviada (${items.length} ítems)`);
}

export function startInventoryLowStockJob(): void {
  stopInventoryLowStockJob();

  registerCronJob(
    INVENTORY_CRON_REGISTRY,
    '0 8 * * *',
    'inventory:stock-minimo',
    runLowStockAlertJob,
  );

  console.log('[inventory] Job de stock mínimo activo (diario 08:00)');
}

export function stopInventoryLowStockJob(): void {
  stopCronJobs(INVENTORY_CRON_REGISTRY);
}
