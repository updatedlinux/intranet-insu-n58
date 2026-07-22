import { Router } from 'express';
import { listDirectory } from '../../controllers/directory.controller';
import { authenticate } from '../../middlewares/authenticate';

const router = Router();

router.use(authenticate);
router.get('/', listDirectory);

export default router;
