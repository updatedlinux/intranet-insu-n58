import { Router } from 'express';
import {
  changePassword,
  forgotPassword,
  login,
  logout,
  me,
  profile,
  resetPassword,
} from '../../controllers/auth.controller';
import { authenticate } from '../../middlewares/authenticate';
import { loginRateLimiter } from '../../middlewares/rateLimiter';

const router = Router();

router.post('/login', loginRateLimiter, login);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.post('/logout', authenticate, logout);
router.get('/me', authenticate, me);
router.get('/profile', authenticate, profile);
router.post('/change-password', authenticate, changePassword);

export default router;
