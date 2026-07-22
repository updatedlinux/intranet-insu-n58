import {
  getInventoryDashboardStats,
  listAssetsGroupedByAssignee,
  listAssetsWarrantyExpiringSoon,
} from '../repositories/asset.repository';
import { listStockMovements } from '../repositories/consumable.repository';

export async function getInventoryDashboardService() {
  const stats = await getInventoryDashboardStats();
  const available = stats.totalAssets - stats.assignedAssets;
  return {
    totalAssets: stats.totalAssets,
    assignedAssets: stats.assignedAssets,
    availableAssets: available,
    maintenanceAssets: stats.maintenanceAssets,
    lowStockConsumables: stats.lowStockConsumables,
    hasLowStockAlert: stats.lowStockConsumables > 0,
  };
}

export async function getInventoryReportsService() {
  const [byUser, warranty, movements] = await Promise.all([
    listAssetsGroupedByAssignee(),
    listAssetsWarrantyExpiringSoon(30),
    listStockMovements(undefined, { sinceDays: 30 }),
  ]);

  return {
    assetsByUser: byUser,
    warrantyExpiring: warranty.map((a) => ({
      id: a.id,
      code: a.code,
      name: a.name,
      warrantyExpiry: a.warrantyExpiry?.toISOString().slice(0, 10) ?? null,
      assigneeName: a.assigneeFirstName ? `${a.assigneeFirstName} ${a.assigneeLastName}` : null,
    })),
    recentMovements: movements.map((m) => ({
      id: m.id,
      consumableName: m.consumableName,
      consumableSku: m.consumableSku,
      type: m.type,
      quantity: m.quantity,
      previousStock: m.previousStock,
      newStock: m.newStock,
      reason: m.reason,
      relatedTicketCode: m.relatedTicketCode,
      performerName: `${m.performerFirstName} ${m.performerLastName}`.trim(),
      createdAt: m.createdAt.toISOString(),
    })),
  };
}
