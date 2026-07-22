import { apiRequest } from './client';
import type { OrgChartResponse } from './org-chart.types';

export function fetchOrgChart() {
  return apiRequest<OrgChartResponse>('/org-chart');
}
