import { Router } from 'express';
import {
  addTaskComment,
  archiveTask,
  assignTask,
  createTask,
  deleteTaskAttachment,
  downloadTaskAttachment,
  getTask,
  moveTask,
  updateTask,
  uploadTaskAttachment,
} from '../../controllers/task.controller';
import { authenticate } from '../../middlewares/authenticate';
import { wrapTaskAttachmentUpload } from '../../middlewares/uploadTaskAttachments';

const router = Router();

router.use(authenticate);

router.post('/', createTask);
router.get('/:taskId/attachments/:attachmentId/download', downloadTaskAttachment);
router.get('/:taskId', getTask);
router.patch('/:taskId', updateTask);
router.patch('/:taskId/move', moveTask);
router.patch('/:taskId/assign', assignTask);
router.patch('/:taskId/archive', archiveTask);
router.post('/:taskId/comments', addTaskComment);
router.post('/:taskId/attachments', wrapTaskAttachmentUpload, uploadTaskAttachment);
router.delete('/:taskId/attachments/:attachmentId', deleteTaskAttachment);

export default router;
