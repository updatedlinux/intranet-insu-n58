import { Router } from 'express';
import {
  announcementCapabilities,
  archiveAnnouncement,
  createAnnouncement,
  getAnnouncement,
  listAnnouncements,
  listLatestAnnouncements,
  listManageAnnouncements,
  publishAnnouncement,
  updateAnnouncement,
  uploadAnnouncementImage,
} from '../../controllers/announcement.controller';
import { authenticate } from '../../middlewares/authenticate';
import { requireAnnouncementManager } from '../../middlewares/announcementManager';
import { wrapAnnouncementImageUpload } from '../../middlewares/uploadAnnouncementImage';

const router = Router();

router.use(authenticate);

router.get('/capabilities', announcementCapabilities);
router.get('/latest', listLatestAnnouncements);
router.get('/manage', requireAnnouncementManager, listManageAnnouncements);
router.post(
  '/upload-image',
  requireAnnouncementManager,
  wrapAnnouncementImageUpload,
  uploadAnnouncementImage,
);
router.get('/', listAnnouncements);
router.get('/:id', getAnnouncement);
router.post('/', requireAnnouncementManager, createAnnouncement);
router.put('/:id', requireAnnouncementManager, updateAnnouncement);
router.patch('/:id/publish', requireAnnouncementManager, publishAnnouncement);
router.patch('/:id/archive', requireAnnouncementManager, archiveAnnouncement);

export default router;
