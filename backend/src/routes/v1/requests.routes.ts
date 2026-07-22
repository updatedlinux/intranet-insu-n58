import { Router } from 'express';
import { authenticate } from '../../middlewares/authenticate';
import {
  createRequest,
  listTargetAreas,
  getRequest,
  linkRequestTask,
  listInboxRequests,
  listMyRequests,
  updateRequestStatus,
} from '../../controllers/request.controller';

const router = Router();

router.use(authenticate);

router.get('/target-areas', listTargetAreas);
router.post('/', createRequest);
router.get('/mine', listMyRequests);
router.get('/inbox', listInboxRequests);
router.get('/:id', getRequest);
router.patch('/:id/status', updateRequestStatus);
router.patch('/:id/link-task', linkRequestTask);

export default router;
