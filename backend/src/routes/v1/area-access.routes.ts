import { Router } from 'express';
import {
  createAreaAccess,
  deleteAreaAccess,
  getAreaAccess,
  listAreaAccess,
  updateAreaAccess,
} from '../../controllers/area-access.controller';
import { ADMIN_ROLES } from '../../constants/roles';
import { authenticate } from '../../middlewares/authenticate';
import { authorize } from '../../middlewares/authorize';

const router = Router();

router.use(authenticate, authorize(...ADMIN_ROLES));

router.get('/', listAreaAccess);
router.get('/:id', getAreaAccess);
router.post('/', createAreaAccess);
router.put('/:id', updateAreaAccess);
router.delete('/:id', deleteAreaAccess);

export default router;
