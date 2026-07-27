import { Router } from 'express';
import multer from 'multer';
import { authenticate } from '../../middlewares/authenticate';
import {
  createSeniatJobHandler,
  downloadSeniatJobHandler,
  downloadSeniatTemplateHandler,
  getSeniatJobHandler,
  streamSeniatJobEvents,
} from '../../controllers/seniat.controller';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok =
      file.mimetype.includes('sheet') ||
      file.mimetype.includes('excel') ||
      /\.xlsx?$/i.test(file.originalname);
    cb(null, ok);
  },
});

const router = Router();

router.use(authenticate);

router.get('/plantilla', downloadSeniatTemplateHandler);
router.post('/jobs', upload.single('file'), createSeniatJobHandler);
router.get('/jobs/:id', getSeniatJobHandler);
router.get('/jobs/:id/events', streamSeniatJobEvents);
router.get('/jobs/:id/download', downloadSeniatJobHandler);

export default router;
