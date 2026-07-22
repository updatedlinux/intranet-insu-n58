import { Router } from 'express';
import {
  cancelMeeting,
  completeMeeting,
  createMeeting,
  getMeeting,
  listMeetings,
  respondMeeting,
  updateMeeting,
} from '../../controllers/meeting.controller';
import { authenticate } from '../../middlewares/authenticate';

const router = Router();

router.use(authenticate);

router.post('/', createMeeting);
router.get('/', listMeetings);
router.patch('/:meetingId/cancel', cancelMeeting);
router.patch('/:meetingId/complete', completeMeeting);
router.patch('/:meetingId/attendees/:userId/respond', respondMeeting);
router.get('/:meetingId', getMeeting);
router.patch('/:meetingId', updateMeeting);

export default router;
