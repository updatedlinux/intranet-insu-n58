import { isAdminRole } from '../constants/roles';
import { isItSupportAgent } from '../policies/it-support.policy';
import { TASK_STATUS_LABELS } from '../constants/task-status';
import { REQUEST_STATUS_LABELS } from '../constants/request-status';
import { listBoardsByAreaIds } from '../repositories/board.repository';
import {
  countDocumentsUploadedByAreas,
  countRequestsByStatusForAreas,
  findPrimaryAreaManager,
  getActiveTasksByAssigneeForBoards,
  getAdminGlobalKpis,
  getBusiestAreaByOpenTasks,
  getCollaboratorCounts,
  getModuleUsageLast30Days,
  getMonthlyAuditActivity,
  getOverdueTasksByUser,
  getTasksByStatusForBoards,
  getTeamTaskAggregates,
  getTicketExtendedMetrics,
  getTopActiveAreas,
  getTopTaskCompleters,
  listLowStockConsumables,
  listMaintenanceAssets,
  listRecentAuditLogs,
  listRecentNotifications,
  listUserTasksSummary,
  listUserUpcomingMeetings,
} from '../repositories/dashboard.repository';
import { countTicketsByCategory } from '../repositories/ticket.repository';
import { getInventoryDashboardStats } from '../repositories/asset.repository';
import { isAreaLeader } from '../policies/document-access.policy';
import { getInboxAreaIds } from '../policies/request-access.policy';
import type { AuthenticatedUser } from '../types/auth';
import type {
  DashboardPayload,
  DashboardQuickAccessItem,
  DashboardStatCard,
  DashboardVariant,
} from '../types/dashboard';
import { countUpcomingCorporateEventsForUser } from '../repositories/corporate-event.repository';
import { listUpcomingEventsForDashboardService } from './corporate-event.service';
import { getDailyMotivationalQuote } from './motivational-quote.service';

function resolveVariant(user: AuthenticatedUser): DashboardVariant {
  if (isAdminRole(user.roleName)) return 'admin';
  if (isItSupportAgent(user)) return 'ti';
  if (isAreaLeader(user)) return 'leader';
  return 'collaborator';
}

function fullName(user: AuthenticatedUser): string {
  return `${user.firstName} ${user.lastName}`.trim();
}

function baseQuickAccess(): DashboardQuickAccessItem[] {
  return [
    {
      key: 'tasks',
      label: 'Mis tareas',
      description: 'Tableros y actividades',
      href: '/actividades',
    },
    {
      key: 'requests',
      label: 'Mis solicitudes',
      description: 'Seguimiento de trámites',
      href: '/solicitudes',
    },
    {
      key: 'tickets',
      label: 'Service Desk',
      description: 'Soporte técnico',
      href: '/service-desk',
    },
    {
      key: 'meetings',
      label: 'Reuniones',
      description: 'Agenda y convocatorias',
      href: '/reuniones',
    },
    { key: 'events', label: 'Eventos', description: 'Actividades corporativas', href: '/eventos' },
    {
      key: 'learning',
      label: 'Learning',
      description: 'Capacitación corporativa',
      href: '/learning',
    },
    {
      key: 'documents',
      label: 'Documentos',
      description: 'Repositorio documental',
      href: '/documentos',
    },
  ];
}

function leaderQuickAccess(boardHref?: string): DashboardQuickAccessItem[] {
  const items = baseQuickAccess();
  items.push(
    {
      key: 'inbox',
      label: 'Bandeja de solicitudes',
      description: 'Solicitudes recibidas',
      href: '/solicitudes',
    },
    {
      key: 'kanban',
      label: 'Board Kanban',
      description: 'Tablero del área',
      href: boardHref ?? '/actividades',
    },
  );
  return items;
}

function tiQuickAccess(): DashboardQuickAccessItem[] {
  return [
    {
      key: 'desk-manage',
      label: 'Panel Service Desk',
      description: 'Gestión de tickets',
      href: '/service-desk/gestion',
    },
    {
      key: 'inventory',
      label: 'Inventario',
      description: 'Activos y consumibles',
      href: '/ti/inventario',
    },
    {
      key: 'new-ticket',
      label: 'Crear ticket',
      description: 'Nuevo caso de soporte',
      href: '/service-desk/nuevo',
    },
    ...baseQuickAccess().slice(0, 3),
  ];
}

function adminQuickAccess(): DashboardQuickAccessItem[] {
  return [
    {
      key: 'admin',
      label: 'Administración',
      description: 'Panel de gobierno',
      href: '/admin/colaboradores',
    },
    {
      key: 'users',
      label: 'Usuarios',
      description: 'Colaboradores del sistema',
      href: '/admin/colaboradores',
    },
    {
      key: 'areas',
      label: 'Áreas',
      description: 'Estructura organizacional',
      href: '/admin/areas',
    },
    {
      key: 'announcements',
      label: 'Comunicados',
      description: 'Gestión de avisos',
      href: '/admin/comunicados',
    },
    {
      key: 'events',
      label: 'Gestión de Eventos',
      description: 'Eventos corporativos',
      href: '/admin/eventos',
    },
    {
      key: 'documents',
      label: 'Documentos',
      description: 'Repositorio global',
      href: '/documentos',
    },
    {
      key: 'metrics',
      label: 'Métricas',
      description: 'Actividades del equipo',
      href: '/actividades/metricas',
    },
  ];
}

async function buildCollaboratorStats(
  userId: number,
  areaId: number,
): Promise<DashboardStatCard[]> {
  const [counts, upcomingEvents] = await Promise.all([
    getCollaboratorCounts(userId),
    countUpcomingCorporateEventsForUser(areaId),
  ]);
  return [
    {
      key: 'pendingTasks',
      label: 'Tareas pendientes',
      value: counts.pendingTasks,
      hint: 'Asignadas a usted',
      variant: 'primary',
    },
    {
      key: 'activeRequests',
      label: 'Solicitudes activas',
      value: counts.activeRequests,
      hint: 'En curso',
      variant: 'purple',
    },
    {
      key: 'upcomingMeetings',
      label: 'Próximas reuniones',
      value: counts.upcomingMeetings,
      hint: 'Hoy y mañana',
      variant: 'success',
    },
    {
      key: 'upcomingEvents',
      label: 'Próximos eventos',
      value: upcomingEvents,
      hint: 'Corporativos',
      variant: 'purple',
    },
    {
      key: 'notifications',
      label: 'Notificaciones',
      value: counts.unreadNotifications,
      hint: 'Sin leer',
      variant: 'orange',
    },
  ];
}

async function getLedBoardIds(user: AuthenticatedUser): Promise<number[]> {
  const areaIds = new Set<number>(user.ledAreaIds);
  if (user.position.isLeader) areaIds.add(user.area.id);
  const boards = await listBoardsByAreaIds([...areaIds]);
  return boards.map((b) => b.id);
}

export async function getDashboardService(user: AuthenticatedUser): Promise<DashboardPayload> {
  const variant = resolveVariant(user);
  const manager = await findPrimaryAreaManager(user.area.id);
  const motivationalQuote = await getDailyMotivationalQuote();

  const [tasks, meetings, notifications, events] = await Promise.all([
    listUserTasksSummary(user.id, 8),
    listUserUpcomingMeetings(user.id, 5),
    listRecentNotifications(user.id, 5),
    listUpcomingEventsForDashboardService(user.area.id, 5),
  ]);

  const userInfo = {
    name: fullName(user),
    area: user.area.name,
    position: user.position.name,
    manager: manager ? { id: manager.id, name: manager.fullName } : null,
  };

  const payload: DashboardPayload = {
    variant,
    user: userInfo,
    quickAccess: baseQuickAccess(),
    stats: { cards: await buildCollaboratorStats(user.id, user.area.id) },
    charts: {},
    alerts: [],
    highlights: {
      tasks: tasks.map((t) => ({
        id: t.id,
        title: t.title,
        priority: t.priority,
        status: t.status,
        dueDate: t.dueDate?.toISOString() ?? null,
        boardId: t.boardId,
      })),
      meetings: meetings.map((m) => ({
        id: m.id,
        title: m.title,
        startDateTime: m.startDateTime.toISOString(),
        endDateTime: m.endDateTime.toISOString(),
        location: m.location,
        isToday: Boolean(m.isToday),
      })),
      events: events.map((e) => ({
        id: e.id,
        title: e.title,
        startDateTime: e.startDateTime,
        endDateTime: e.endDateTime,
        location: e.location,
        audienceLabel: e.audienceLabel,
        isCompanyWide: e.isCompanyWide,
      })),
      notifications: notifications.map((n) => ({
        id: n.id,
        title: n.title,
        message: n.message,
        createdAt: n.createdAt.toISOString(),
        isRead: n.isRead,
      })),
    },
    motivationalQuote,
  };

  if (variant === 'leader') {
    const inboxIds = await getInboxAreaIds(user);
    const areaIds = inboxIds === 'all' ? user.ledAreaIds : inboxIds;
    const boardIds = await getLedBoardIds(user);
    const boards = await listBoardsByAreaIds(areaIds.length ? areaIds : [user.area.id]);
    const primaryBoard = boards[0];

    const [
      teamAgg,
      byStatus,
      topPerformers,
      overdueByUser,
      docsUploaded,
      requestsByStatus,
      byAssignee,
    ] = await Promise.all([
      getTeamTaskAggregates(boardIds),
      getTasksByStatusForBoards(boardIds),
      getTopTaskCompleters(boardIds, 30, 5),
      getOverdueTasksByUser(boardIds, 5),
      countDocumentsUploadedByAreas(areaIds.length ? areaIds : [user.area.id], 30),
      countRequestsByStatusForAreas(areaIds.length ? areaIds : [user.area.id]),
      getActiveTasksByAssigneeForBoards(boardIds, 8),
    ]);

    payload.quickAccess = leaderQuickAccess(
      primaryBoard ? `/actividades/boards/${primaryBoard.id}` : undefined,
    );
    payload.stats.cards = [
      {
        key: 'teamActive',
        label: 'Tareas activas del equipo',
        value: teamAgg.activeTasks,
        variant: 'primary',
      },
      {
        key: 'completed7',
        label: 'Completadas (7 días)',
        value: teamAgg.completed7Days,
        variant: 'success',
      },
      {
        key: 'completed30',
        label: 'Completadas (30 días)',
        value: teamAgg.completed30Days,
        variant: 'purple',
      },
      {
        key: 'overdue',
        label: 'Tareas vencidas',
        value: teamAgg.overdueTasks,
        variant: 'danger',
      },
    ];
    payload.charts = {
      primary: {
        labels: byStatus.map(
          (s) => TASK_STATUS_LABELS[s.status as keyof typeof TASK_STATUS_LABELS] ?? s.status,
        ),
        data: byStatus.map((s) => s.count),
      },
      secondary: {
        labels: byAssignee.map((a) => a.name),
        data: byAssignee.map((a) => a.count),
      },
    };
    payload.highlights.leader = {
      teamActiveTasks: teamAgg.activeTasks,
      teamCompleted7Days: teamAgg.completed7Days,
      teamCompleted30Days: teamAgg.completed30Days,
      teamOverdueTasks: teamAgg.overdueTasks,
      documentsUploaded30Days: docsUploaded,
      inboxRequestsByStatus: requestsByStatus.map((r) => ({
        status: r.status,
        label: REQUEST_STATUS_LABELS[r.status as keyof typeof REQUEST_STATUS_LABELS] ?? r.status,
        count: r.count,
      })),
      topPerformers,
      overdueByUser,
    };
  }

  if (variant === 'ti') {
    const [ticketMetrics, inventory, lowStock, maintenance, ticketsByCategory] = await Promise.all([
      getTicketExtendedMetrics(),
      getInventoryDashboardStats(),
      listLowStockConsumables(8),
      listMaintenanceAssets(8),
      countTicketsByCategory(),
    ]);

    payload.quickAccess = tiQuickAccess();
    payload.stats.cards = (
      [
        {
          key: 'openTickets',
          label: 'Tickets abiertos',
          value: ticketMetrics.openCount,
          variant: 'primary' as const,
        },
        {
          key: 'inProgressTickets',
          label: 'En progreso',
          value: ticketMetrics.inProgressCount,
          variant: 'purple' as const,
        },
        {
          key: 'criticalTickets',
          label: 'Tickets críticos',
          value: ticketMetrics.criticalCount,
          variant: 'danger' as const,
        },
        {
          key: 'sla',
          label: 'SLA promedio (h)',
          value:
            ticketMetrics.avgResolutionHours != null
              ? Number(ticketMetrics.avgResolutionHours.toFixed(1))
              : '—',
          hint: 'Tiempo medio de resolución',
          variant: 'orange' as const,
        },
        {
          key: 'totalAssets',
          label: 'Activos totales',
          value: inventory.totalAssets,
          variant: 'success' as const,
        },
        {
          key: 'maintenanceAssets',
          label: 'En mantenimiento',
          value: inventory.maintenanceAssets,
          variant: 'orange' as const,
        },
        {
          key: 'lowStock',
          label: 'Stock crítico',
          value: inventory.lowStockConsumables,
          variant: 'danger' as const,
        },
      ] satisfies DashboardStatCard[]
    ).slice(0, 4);

    payload.charts = {
      primary: {
        labels: ticketsByCategory.map((c) => c.categoryName),
        data: ticketsByCategory.map((c) => c.count),
      },
      secondary: {
        labels: ['Resueltos 7 días'],
        data: [ticketMetrics.resolvedLast7Days],
      },
    };

    payload.alerts = [
      ...lowStock.map((c) => ({
        id: `consumable-${c.id}`,
        severity: 'danger' as const,
        title: 'Stock crítico',
        message: `${c.name}: ${c.currentStock} / mín. ${c.minimumStock}`,
        href: '/ti/inventario',
      })),
      ...maintenance.map((a) => ({
        id: `asset-${a.id}`,
        severity: 'warning' as const,
        title: 'Activo en mantenimiento',
        message: `${a.code} — ${a.name}`,
        href: '/ti/inventario',
      })),
    ];

    payload.highlights.ti = {
      criticalTickets: ticketMetrics.criticalCount,
      resolvedLast7Days: ticketMetrics.resolvedLast7Days,
      lowStockItems: lowStock,
      maintenanceAssets: maintenance,
    };

    if (isAreaLeader(user)) {
      const boardIds = await getLedBoardIds(user);
      const teamAgg = await getTeamTaskAggregates(boardIds);
      payload.highlights.leader = {
        teamActiveTasks: teamAgg.activeTasks,
        teamCompleted7Days: teamAgg.completed7Days,
        teamCompleted30Days: teamAgg.completed30Days,
        teamOverdueTasks: teamAgg.overdueTasks,
        documentsUploaded30Days: 0,
        inboxRequestsByStatus: [],
        topPerformers: [],
        overdueByUser: [],
      };
    }
  }

  if (variant === 'admin') {
    const [kpis, moduleUsage, monthly, topAreas, busiest, audit] = await Promise.all([
      getAdminGlobalKpis(),
      getModuleUsageLast30Days(),
      getMonthlyAuditActivity(6),
      getTopActiveAreas(5),
      getBusiestAreaByOpenTasks(),
      listRecentAuditLogs(8),
    ]);

    payload.quickAccess = adminQuickAccess();
    payload.stats.cards = [
      { key: 'users', label: 'Usuarios activos', value: kpis.activeUsers, variant: 'primary' },
      {
        key: 'documents',
        label: 'Total documentos',
        value: kpis.totalDocuments,
        variant: 'purple',
      },
      { key: 'tasks', label: 'Total tareas', value: kpis.totalTasks, variant: 'success' },
      { key: 'tickets', label: 'Total tickets', value: kpis.totalTickets, variant: 'orange' },
      {
        key: 'requests',
        label: 'Total solicitudes',
        value: kpis.totalRequests,
        variant: 'primary',
      },
    ];

    payload.charts = {
      moduleUsage: {
        labels: ['Documentos', 'Learning', 'Chat', 'Service Desk'],
        data: [
          moduleUsage.documents,
          moduleUsage.learning,
          moduleUsage.chat,
          moduleUsage.serviceDesk,
        ],
      },
      monthlyActivity: {
        labels: monthly.map((m) => m.month),
        data: monthly.map((m) => m.count),
      },
    };

    payload.highlights.admin = {
      activeUsers: kpis.activeUsers,
      totalDocuments: kpis.totalDocuments,
      totalTasks: kpis.totalTasks,
      totalTickets: kpis.totalTickets,
      totalRequests: kpis.totalRequests,
      topAreas,
      busiestArea: busiest,
      recentAudit: audit.map((a) => ({
        id: a.id,
        action: a.action,
        actorName: a.actorName,
        createdAt: a.createdAt.toISOString(),
      })),
    };
  }

  return payload;
}
