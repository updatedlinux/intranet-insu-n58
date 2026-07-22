import { Router } from 'express';
import {
  createChatAreaAccess,
  deleteChatAreaAccess,
  getChatAreaAccess,
  listChatAreaAccess,
  updateChatAreaAccess,
} from '../../controllers/chat-area-access.controller';
import { ADMIN_ROLES } from '../../constants/roles';
import { authenticate } from '../../middlewares/authenticate';
import { authorize } from '../../middlewares/authorize';

const router = Router();

router.use(authenticate, authorize(...ADMIN_ROLES));

router.get('/', listChatAreaAccess);
router.get('/:id', getChatAreaAccess);
router.post('/', createChatAreaAccess);
router.put('/:id', updateChatAreaAccess);
router.delete('/:id', deleteChatAreaAccess);

export default router;
