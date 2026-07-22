import type { NextFunction, Request, Response } from 'express';
import type { AppError } from '../middlewares/error.middleware';
import {
  certificateService,
  completeLessonService,
  courseReportService,
  createCourseService,
  createModuleService,
  deleteCourseService,
  deleteLessonService,
  deleteModuleService,
  getManageCourseService,
  getMyCourseDetailService,
  listLearningAreasService,
  listManageCoursesService,
  listMyCoursesService,
  searchLearningUsersService,
  streamCourseCoverService,
  streamLessonService,
  updateCourseService,
  updateLessonService,
  updateModuleService,
  uploadCourseCoverService,
  uploadLessonsService,
} from '../services/learning.service';

function parseId(v: string | string[]): number {
  const raw = Array.isArray(v) ? v[0] : v;
  const id = Number.parseInt(raw ?? '', 10);
  if (!Number.isInteger(id) || id <= 0) {
    const e = new Error('ID inválido') as AppError;
    e.statusCode = 400;
    throw e;
  }
  return id;
}

function parseBodyIds(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((x) => Number.parseInt(String(x), 10))
    .filter((n) => Number.isInteger(n) && n > 0);
}

export async function listMyCourses(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await listMyCoursesService(req.user!);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function getMyCourse(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const courseId = parseId(req.params.courseId);
    const result = await getMyCourseDetailService(req.user!, courseId);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function streamCourseCover(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const courseId = parseId(req.params.courseId);
    const result = await streamCourseCoverService(req.user!, courseId);
    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    result.stream.on('error', (err) => next(err));
    result.stream.pipe(res);
  } catch (error) {
    next(error);
  }
}

export async function streamLesson(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const lessonId = parseId(req.params.lessonId);
    const rangeHeader = typeof req.headers.range === 'string' ? req.headers.range : undefined;
    const result = await streamLessonService(req.user!, lessonId, rangeHeader);

    res.status(result.statusCode);
    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Content-Length', String(result.contentLength));
    if (result.acceptRanges) {
      res.setHeader('Accept-Ranges', 'bytes');
    }
    if (result.contentRange) {
      res.setHeader('Content-Range', result.contentRange);
    }
    res.setHeader('Cache-Control', 'private, no-cache');

    result.stream.on('error', (err) => next(err));
    result.stream.pipe(res);
  } catch (error) {
    next(error);
  }
}

export async function completeLesson(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const lessonId = parseId(req.params.id);
    const result = await completeLessonService(req.user!, lessonId);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function downloadCertificate(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const courseId = parseId(req.params.courseId);
    const pdf = await certificateService(req.user!, courseId);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="constancia-learning.pdf"');
    res.send(pdf);
  } catch (error) {
    next(error);
  }
}

export async function listManageCourses(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await listManageCoursesService(req.user!);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function getManageCourse(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const courseId = parseId(req.params.courseId);
    const result = await getManageCourseService(req.user!, courseId);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function createCourse(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const body = req.body as Record<string, unknown>;
    const result = await createCourseService(req.user!, {
      title: String(body.title ?? ''),
      description: body.description != null ? String(body.description) : null,
      isPublished: Boolean(body.isPublished),
      areaIds: parseBodyIds(body.areaIds),
      exceptionUserIds: parseBodyIds(body.exceptionUserIds),
    });
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

export async function updateCourse(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const courseId = parseId(req.params.courseId);
    const body = req.body as Record<string, unknown>;
    const result = await updateCourseService(req.user!, courseId, {
      title: String(body.title ?? ''),
      description: body.description != null ? String(body.description) : null,
      isPublished: Boolean(body.isPublished),
      areaIds: parseBodyIds(body.areaIds),
      exceptionUserIds: parseBodyIds(body.exceptionUserIds),
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function deleteCourse(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const courseId = parseId(req.params.courseId);
    await deleteCourseService(req.user!, courseId);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

export async function uploadCourseCover(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.file) {
      const error = new Error('Debe enviar un archivo en el campo "cover"') as AppError;
      error.statusCode = 400;
      throw error;
    }
    const courseId = parseId(req.params.courseId);
    const result = await uploadCourseCoverService(req.user!, courseId, {
      buffer: req.file.buffer,
      mimetype: req.file.mimetype,
      originalname: req.file.originalname,
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function createModule(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const courseId = parseId(req.params.courseId);
    const body = req.body as Record<string, unknown>;
    const result = await createModuleService(req.user!, courseId, {
      title: String(body.title ?? ''),
      order: body.order != null ? Number(body.order) : undefined,
    });
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

export async function updateModule(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const moduleId = parseId(req.params.moduleId);
    const body = req.body as Record<string, unknown>;
    const result = await updateModuleService(req.user!, moduleId, {
      title: String(body.title ?? ''),
      order: Number(body.order ?? 0),
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function deleteModule(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const moduleId = parseId(req.params.moduleId);
    await deleteModuleService(req.user!, moduleId);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

export async function uploadLessons(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const files = req.files as Express.Multer.File[] | undefined;
    if (!files?.length) {
      const error = new Error('Debe enviar al menos un archivo') as AppError;
      error.statusCode = 400;
      throw error;
    }
    const moduleId = parseId(req.params.moduleId);
    const result = await uploadLessonsService(
      req.user!,
      moduleId,
      files.map((f) => ({
        buffer: f.buffer,
        mimetype: f.mimetype,
        originalname: f.originalname,
        size: f.size,
      })),
    );
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

export async function updateLesson(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const lessonId = parseId(req.params.lessonId);
    const body = req.body as Record<string, unknown>;
    const result = await updateLessonService(req.user!, lessonId, {
      title: String(body.title ?? ''),
      description: body.description != null ? String(body.description) : null,
      order: Number(body.order ?? 0),
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function deleteLesson(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const lessonId = parseId(req.params.lessonId);
    await deleteLessonService(req.user!, lessonId);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

export async function courseReport(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const courseId = parseId(req.params.courseId);
    const result = await courseReportService(req.user!, courseId);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function searchLearningUsers(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q : '';
    const result = await searchLearningUsersService(req.user!, q);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function listLearningAreas(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await listLearningAreasService(req.user!);
    res.json(result);
  } catch (error) {
    next(error);
  }
}
