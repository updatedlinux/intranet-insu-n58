import { Router } from 'express';
import {
  createDirectRoom,
  getMessages,
  getUnreadCount,
  listRooms,
  streamFile,
  uploadAttachment,
} from '../../controllers/chat.controller';
import { authenticate } from '../../middlewares/authenticate';
import {
  chatUploadMiddleware,
  handleChatUploadError,
} from '../../middlewares/uploadChatAttachment';

const router = Router();

router.use(authenticate);

router.get('/rooms', listRooms);
router.get('/unread-count', getUnreadCount);
router.get('/rooms/:roomId/messages', getMessages);
router.post('/rooms/direct', createDirectRoom);
router.post(
  '/upload',
  (req, res, next) => {
    chatUploadMiddleware(req, res, (err) => {
      if (err) {
        handleChatUploadError(err, req, res, next);
        return;
      }
      next();
    });
  },
  uploadAttachment,
);
router.get('/files/:messageId', streamFile);

export default router;
