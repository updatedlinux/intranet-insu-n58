import { Router } from 'express';
import { getDashboard } from '../../controllers/dashboard.controller';
import { authenticate } from '../../middlewares/authenticate';

const router = Router();

router.get('/', authenticate, getDashboard);

export default router;
