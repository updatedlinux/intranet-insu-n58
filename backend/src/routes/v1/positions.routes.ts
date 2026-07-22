import { Router } from 'express';
import { ADMIN_ROLES } from '../../constants/roles';
import {
  createPositionHandler,
  deletePositionHandler,
  getPositionHandler,
  listPositionsHandler,
  togglePositionHandler,
  updatePositionHandler,
} from '../../controllers/position.controller';
import { authenticate } from '../../middlewares/authenticate';
import { authorize } from '../../middlewares/authorize';

const router = Router();

const adminOnly = [authenticate, authorize(...ADMIN_ROLES)] as const;

router.get('/', ...adminOnly, listPositionsHandler);
router.get('/:id', ...adminOnly, getPositionHandler);
router.post('/', ...adminOnly, createPositionHandler);
router.put('/:id', ...adminOnly, updatePositionHandler);
router.patch('/:id/toggle', ...adminOnly, togglePositionHandler);
router.delete('/:id', ...adminOnly, deletePositionHandler);

export default router;
