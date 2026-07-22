import { Router } from 'express';
import { testEmail } from '../../controllers/dev.controller';

const router = Router();

router.post('/test-email', testEmail);

export default router;
