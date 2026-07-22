import { Router } from 'express';
import { deleteAvatar, serveAvatar, uploadAvatar } from '../../controllers/avatar.controller';
import { authenticate } from '../../middlewares/authenticate';
import { avatarUploadMiddleware, handleAvatarUploadError } from '../../middlewares/uploadAvatar';

const router = Router();

router.get('/:id/avatar', authenticate, serveAvatar);

router.post(
  '/:id/avatar',
  authenticate,
  (req, res, next) => {
    avatarUploadMiddleware(req, res, (err) => {
      if (err) {
        handleAvatarUploadError(err, req, res, next);
        return;
      }
      next();
    });
  },
  uploadAvatar,
);

router.delete('/:id/avatar', authenticate, deleteAvatar);

export default router;
