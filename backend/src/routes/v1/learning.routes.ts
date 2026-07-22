import { Router } from 'express';
import {
  completeLesson,
  courseReport,
  createCourse,
  createModule,
  deleteCourse,
  deleteLesson,
  deleteModule,
  downloadCertificate,
  getManageCourse,
  getMyCourse,
  listLearningAreas,
  listManageCourses,
  listMyCourses,
  searchLearningUsers,
  streamCourseCover,
  streamLesson,
  updateCourse,
  updateLesson,
  updateModule,
  uploadCourseCover,
  uploadLessons,
} from '../../controllers/learning.controller';
import { authenticate } from '../../middlewares/authenticate';
import { requireLearningManager } from '../../middlewares/requireLearningManager';
import {
  handleLearningCoverUploadError,
  handleLearningLessonsUploadError,
  learningCoverUploadMiddleware,
  learningLessonsUploadMiddleware,
} from '../../middlewares/uploadLearning';

const router = Router();

router.use(authenticate);

router.get('/courses', listMyCourses);
router.get('/courses/:courseId/cover', streamCourseCover);
router.get('/courses/:courseId', getMyCourse);
router.get('/courses/:courseId/certificate', downloadCertificate);
router.get('/stream/:lessonId', streamLesson);
router.post('/lessons/:id/complete', completeLesson);

const manage = Router();
manage.use(requireLearningManager);
manage.get('/courses', listManageCourses);
manage.get('/areas', listLearningAreas);
manage.get('/users/search', searchLearningUsers);
manage.post('/courses', createCourse);
manage.get('/courses/:courseId', getManageCourse);
manage.put('/courses/:courseId', updateCourse);
manage.delete('/courses/:courseId', deleteCourse);
manage.get('/courses/:courseId/report', courseReport);
manage.post(
  '/courses/:courseId/cover',
  (req, res, next) => {
    learningCoverUploadMiddleware(req, res, (err) => {
      if (err) {
        handleLearningCoverUploadError(err, req, res, next);
        return;
      }
      next();
    });
  },
  uploadCourseCover,
);
manage.post('/courses/:courseId/modules', createModule);
manage.put('/modules/:moduleId', updateModule);
manage.delete('/modules/:moduleId', deleteModule);
manage.post(
  '/modules/:moduleId/lessons',
  (req, res, next) => {
    learningLessonsUploadMiddleware(req, res, (err) => {
      if (err) {
        handleLearningLessonsUploadError(err, req, res, next);
        return;
      }
      next();
    });
  },
  uploadLessons,
);
manage.put('/lessons/:lessonId', updateLesson);
manage.delete('/lessons/:lessonId', deleteLesson);

router.use('/manage', manage);

export default router;
