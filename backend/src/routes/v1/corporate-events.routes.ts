import { Router } from 'express';
import { ADMIN_ROLES } from '../../constants/roles';
import {
  cancelEvent,
  createEvent,
  getEvent,
  getEventManage,
  listEvents,
  listEventsManage,
  publishEvent,
  updateEvent,
} from '../../controllers/corporate-event.controller';
import { authenticate } from '../../middlewares/authenticate';
import { authorize } from '../../middlewares/authorize';

const router = Router();

const adminOnly = [authenticate, authorize(...ADMIN_ROLES)] as const;

router.get('/', authenticate, listEvents);
router.get('/manage', authenticate, authorize(...ADMIN_ROLES), listEventsManage);
router.get('/manage/:id', ...adminOnly, getEventManage);
router.get('/:id', authenticate, getEvent);

router.post('/', ...adminOnly, createEvent);
router.put('/:id', ...adminOnly, updateEvent);
router.patch('/:id/publish', ...adminOnly, publishEvent);
router.patch('/:id/cancel', ...adminOnly, cancelEvent);

export default router;
