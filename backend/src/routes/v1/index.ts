import { Router } from 'express';
import { config } from '../../config';
import areaAccessRoutes from './area-access.routes';
import adminRoutes from './admin.routes';
import areasRoutes from './areas.routes';
import orgChartRoutes from './org-chart.routes';
import positionsRoutes from './positions.routes';
import authRoutes from './auth.routes';
import corporateEventsRoutes from './corporate-events.routes';
import dashboardRoutes from './dashboard.routes';
import devRoutes from './dev.routes';
import announcementsRoutes from './announcements.routes';
import directoryRoutes from './directory.routes';
import docsRoutes from './docs.routes';
import tagsRoutes from './tags.routes';
import ticketsRoutes from './tickets.routes';
import ticketCategoriesRoutes from './ticket-categories.routes';
import boardsRoutes from './boards.routes';
import tasksRoutes from './tasks.routes';
import meetingsRoutes from './meetings.routes';
import requestsRoutes from './requests.routes';
import assetsRoutes from './assets.routes';
import consumablesRoutes from './consumables.routes';
import inventoryRoutes from './inventory.routes';
import inventoryCategoriesRoutes from './inventory-categories.routes';
import learningRoutes from './learning.routes';
import chatAreaAccessRoutes from './chat-area-access.routes';
import chatRoutes from './chat.routes';
import healthRoutes from './health.routes';
import notificationsRoutes from './notifications.routes';
import usersRoutes from './users.routes';

const router = Router();

router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/area-access', areaAccessRoutes);
router.use('/admin', adminRoutes);
router.use('/areas', areasRoutes);
router.use('/positions', positionsRoutes);
router.use('/announcements', announcementsRoutes);
router.use('/directory', directoryRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/docs', docsRoutes);
router.use('/tags', tagsRoutes);
router.use('/tickets', ticketsRoutes);
router.use('/ticket-categories', ticketCategoriesRoutes);
router.use('/boards', boardsRoutes);
router.use('/tasks', tasksRoutes);
router.use('/meetings', meetingsRoutes);
router.use('/requests', requestsRoutes);
router.use('/assets', assetsRoutes);
router.use('/consumables', consumablesRoutes);
router.use('/inventory', inventoryRoutes);
router.use('/inventory-categories', inventoryCategoriesRoutes);
router.use('/learning', learningRoutes);
router.use('/chat', chatRoutes);
router.use('/chat-exceptions', chatAreaAccessRoutes);
router.use('/events', corporateEventsRoutes);
router.use('/users', usersRoutes);
router.use('/notifications', notificationsRoutes);
router.use('/org-chart', orgChartRoutes);

if (config.isDevelopment) {
  router.use('/dev', devRoutes);
}

export default router;
