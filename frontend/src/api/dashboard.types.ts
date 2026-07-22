export type DashboardVariant = 'collaborator' | 'leader' | 'ti' | 'admin';

export interface DashboardQuickAccessItem {
  key: string;
  label: string;
  description: string;
  href: string;
}

export interface DashboardStatCard {
  key: string;
  label: string;
  value: string | number;
  hint?: string;
  variant: 'purple' | 'success' | 'primary' | 'orange' | 'danger';
}

export interface DashboardChartSeries {
  labels: string[];
  data: number[];
}

export interface DashboardAlert {
  id: string;
  severity: 'info' | 'warning' | 'danger';
  title: string;
  message: string;
  href?: string;
}

export interface DashboardTaskRow {
  id: number;
  title: string;
  priority: string;
  status: string;
  dueDate: string | null;
  boardId: number;
}

export interface DashboardMeetingRow {
  id: number;
  title: string;
  startDateTime: string;
  endDateTime: string;
  location: string | null;
  isToday: boolean;
}

export interface DashboardEventRow {
  id: number;
  title: string;
  startDateTime: string;
  endDateTime: string;
  location: string | null;
  audienceLabel: string;
  isCompanyWide: boolean;
}

export interface DashboardNotificationRow {
  id: number;
  title: string;
  message: string;
  createdAt: string;
  isRead: boolean;
}

export interface DashboardMotivationalQuote {
  text: string;
  author: string;
  source: 'api' | 'fallback';
}

export interface DashboardUserInfo {
  name: string;
  area: string;
  position: string;
  manager: { id: number; name: string } | null;
}

export interface DashboardLeaderHighlights {
  teamActiveTasks: number;
  teamCompleted7Days: number;
  teamCompleted30Days: number;
  teamOverdueTasks: number;
  documentsUploaded30Days: number;
  inboxRequestsByStatus: { status: string; label: string; count: number }[];
  topPerformers: { userId: number; name: string; completedCount: number }[];
  overdueByUser: { userId: number; name: string; overdueCount: number }[];
}

export interface DashboardTiHighlights {
  criticalTickets: number;
  resolvedLast7Days: number;
  lowStockItems: { id: number; name: string; currentStock: number; minimumStock: number }[];
  maintenanceAssets: { id: number; code: string; name: string }[];
}

export interface DashboardAdminHighlights {
  activeUsers: number;
  totalDocuments: number;
  totalTasks: number;
  totalTickets: number;
  totalRequests: number;
  topAreas: { areaId: number; areaName: string; activityScore: number }[];
  busiestArea: { areaId: number; areaName: string; openTasks: number } | null;
  recentAudit: { id: number; action: string; actorName: string | null; createdAt: string }[];
}

export interface DashboardPayload {
  variant: DashboardVariant;
  user: DashboardUserInfo;
  quickAccess: DashboardQuickAccessItem[];
  stats: { cards: DashboardStatCard[] };
  charts: {
    primary?: DashboardChartSeries;
    secondary?: DashboardChartSeries;
    moduleUsage?: DashboardChartSeries;
    monthlyActivity?: DashboardChartSeries;
  };
  alerts: DashboardAlert[];
  highlights: {
    tasks: DashboardTaskRow[];
    meetings: DashboardMeetingRow[];
    events: DashboardEventRow[];
    notifications: DashboardNotificationRow[];
    leader?: DashboardLeaderHighlights;
    ti?: DashboardTiHighlights;
    admin?: DashboardAdminHighlights;
  };
  motivationalQuote: DashboardMotivationalQuote;
}
