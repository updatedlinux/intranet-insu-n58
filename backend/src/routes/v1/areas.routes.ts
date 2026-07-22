import { Router } from 'express';
import { ADMIN_ROLES } from '../../constants/roles';
import {
  createAreaHandler,
  deleteAreaHandler,
  getAreaDeletePreviewHandler,
  getAreaHandler,
  listAreasHandler,
  toggleAreaHandler,
  updateAreaHandler,
} from '../../controllers/area.controller';
import { authenticate } from '../../middlewares/authenticate';
import { authorize } from '../../middlewares/authorize';

const router = Router();

const adminOnly = [authenticate, authorize(...ADMIN_ROLES)] as const;

router.get('/', ...adminOnly, listAreasHandler);
router.get('/:id/delete-preview', ...adminOnly, getAreaDeletePreviewHandler);
router.get('/:id', ...adminOnly, getAreaHandler);
router.post('/', ...adminOnly, createAreaHandler);
router.put('/:id', ...adminOnly, updateAreaHandler);
router.patch('/:id/toggle', ...adminOnly, toggleAreaHandler);
router.delete('/:id', ...adminOnly, deleteAreaHandler);

export default router;
