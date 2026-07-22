import { getInventoryDashboardStats } from '../repositories/asset.repository';
import {
  getAdminGlobalKpis,
  getModuleUsageLast30Days,
  getTicketExtendedMetrics,
} from '../repositories/dashboard.repository';
import { countTicketsByCategory } from '../repositories/ticket.repository';

export async function getTicketDashboardMetrics() {
  const [metrics, byCategory] = await Promise.all([
    getTicketExtendedMetrics(),
    countTicketsByCategory(),
  ]);
  return { metrics, byCategory };
}

export async function getInventoryDashboardMetrics() {
  return getInventoryDashboardStats();
}

export async function getPlatformKpis() {
  const [global, modules] = await Promise.all([getAdminGlobalKpis(), getModuleUsageLast30Days()]);
  return { global, modules };
}
