import { Router } from 'express';
import { getDashboard, getReports } from '../../controllers/inventory.controller';
import { authenticate } from '../../middlewares/authenticate';
import { requireItInventory } from '../../middlewares/requireItInventory';

const router = Router();
router.use(authenticate, requireItInventory);

router.get('/dashboard', getDashboard);
router.get('/reports', getReports);

export default router;
