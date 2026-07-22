import { Router } from 'express';
import { getOrgChart } from '../../controllers/org-chart.controller';
import { authenticate } from '../../middlewares/authenticate';

const router = Router();

router.get('/', authenticate, getOrgChart);

export default router;
