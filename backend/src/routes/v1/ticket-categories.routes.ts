import { Router } from 'express';
import { ADMIN_ROLES } from '../../constants/roles';
import {
  createTicketCategoryHandler,
  deleteTicketCategoryHandler,
  getTicketCategoryHandler,
  listTicketCategoriesHandler,
  toggleTicketCategoryHandler,
  updateTicketCategoryHandler,
} from '../../controllers/ticket-category.controller';
import { authenticate } from '../../middlewares/authenticate';
import { authorize } from '../../middlewares/authorize';

const router = Router();

router.get('/', authenticate, listTicketCategoriesHandler);

const adminOnly = [authenticate, authorize(...ADMIN_ROLES)] as const;

router.get('/:id', ...adminOnly, getTicketCategoryHandler);
router.post('/', ...adminOnly, createTicketCategoryHandler);
router.put('/:id', ...adminOnly, updateTicketCategoryHandler);
router.patch('/:id/toggle', ...adminOnly, toggleTicketCategoryHandler);
router.delete('/:id', ...adminOnly, deleteTicketCategoryHandler);

export default router;
