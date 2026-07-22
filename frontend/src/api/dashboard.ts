import { apiRequest } from './client';
import type { DashboardPayload } from './dashboard.types';

export function fetchDashboard(): Promise<DashboardPayload> {
  return apiRequest('/dashboard');
}
