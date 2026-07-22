import { Router } from 'express';
import {
  addTicketComment,
  assignTicket,
  createTicket,
  downloadTicketAttachment,
  getTicket,
  getTicketMetrics,
  listTickets,
  patchTicketPriority,
  patchTicketStatus,
  ticketCapabilities,
} from '../../controllers/ticket.controller';
import { authenticate } from '../../middlewares/authenticate';
import { wrapTicketCreateUpload } from '../../middlewares/uploadTicketAttachments';

const router = Router();

router.use(authenticate);

router.get('/capabilities', ticketCapabilities);
router.get('/metrics', getTicketMetrics);
router.get('/', listTickets);
router.post('/', wrapTicketCreateUpload, createTicket);
router.get('/:id/attachments/:attachmentId/download', downloadTicketAttachment);
router.get('/:id', getTicket);
router.patch('/:id/assign', assignTicket);
router.patch('/:id/status', patchTicketStatus);
router.patch('/:id/priority', patchTicketPriority);
router.post('/:id/comments', addTicketComment);

export default router;
