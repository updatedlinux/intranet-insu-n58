import { Router } from 'express';
import { ADMIN_ROLES } from '../../constants/roles';
import {
  createTagHandler,
  deleteTagHandler,
  getTagHandler,
  listTagsHandler,
  toggleTagHandler,
  updateTagHandler,
} from '../../controllers/tag.controller';
import { authenticate } from '../../middlewares/authenticate';
import { authorize } from '../../middlewares/authorize';

const router = Router();

router.get('/', authenticate, listTagsHandler);

const adminOnly = [authenticate, authorize(...ADMIN_ROLES)] as const;

router.get('/:id', ...adminOnly, getTagHandler);
router.post('/', ...adminOnly, createTagHandler);
router.put('/:id', ...adminOnly, updateTagHandler);
router.patch('/:id/toggle', ...adminOnly, toggleTagHandler);
router.delete('/:id', ...adminOnly, deleteTagHandler);

export default router;
