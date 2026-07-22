import { apiRequest, ApiError } from './client';
import type {
  LearningCourseCard,
  LearningModuleItem,
  LearningReportRow,
  LearningUserOption,
  ManageCourseDetail,
  ManageCourseSummary,
} from './learning.types';

const API_BASE = import.meta.env.VITE_API_URL ?? '/api/v1';

export function learningCoverUrl(courseId: number): string {
  return `${API_BASE}/learning/courses/${courseId}/cover`;
}

export function learningStreamUrl(lessonId: number): string {
  return `${API_BASE}/learning/stream/${lessonId}`;
}

export function learningCertificateUrl(courseId: number): string {
  return `${API_BASE}/learning/courses/${courseId}/certificate`;
}

export async function fetchMyLearningCourses(): Promise<{ items: LearningCourseCard[] }> {
  return apiRequest('/learning/courses');
}

export async function fetchMyLearningCourse(courseId: number): Promise<{
  course: {
    id: number;
    code: string;
    title: string;
    description: string | null;
    coverUrl: string | null;
  };
  modules: LearningModuleItem[];
  progress: { totalLessons: number; completedLessons: number; percent: number; status: string };
  completedLessonIds: number[];
}> {
  return apiRequest(`/learning/courses/${courseId}`);
}

export async function completeLearningLesson(lessonId: number): Promise<{
  ok: boolean;
  progress: { percent: number; status: string };
}> {
  return apiRequest(`/learning/lessons/${lessonId}/complete`, { method: 'POST' });
}

export async function fetchManageLearningCourses(): Promise<{ items: ManageCourseSummary[] }> {
  return apiRequest('/learning/manage/courses');
}

export async function fetchManageLearningCourse(courseId: number): Promise<ManageCourseDetail> {
  return apiRequest(`/learning/manage/courses/${courseId}`);
}

export async function createLearningCourse(body: {
  title: string;
  description?: string | null;
  isPublished?: boolean;
  areaIds: number[];
  exceptionUserIds: number[];
}): Promise<ManageCourseDetail> {
  return apiRequest('/learning/manage/courses', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function updateLearningCourse(
  courseId: number,
  body: {
    title: string;
    description?: string | null;
    isPublished?: boolean;
    areaIds: number[];
    exceptionUserIds: number[];
  },
): Promise<ManageCourseDetail> {
  return apiRequest(`/learning/manage/courses/${courseId}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

export async function deleteLearningCourse(courseId: number): Promise<void> {
  return apiRequest(`/learning/manage/courses/${courseId}`, { method: 'DELETE' });
}

export async function fetchLearningCourseReport(
  courseId: number,
): Promise<{ items: LearningReportRow[] }> {
  return apiRequest(`/learning/manage/courses/${courseId}/report`);
}

export async function fetchLearningAreas(): Promise<{ areas: { id: number; name: string }[] }> {
  return apiRequest('/learning/manage/areas');
}

export async function searchLearningUsers(q: string): Promise<{ items: LearningUserOption[] }> {
  return apiRequest(`/learning/manage/users/search?q=${encodeURIComponent(q)}`);
}

export async function createLearningModule(
  courseId: number,
  body: { title: string; order?: number },
): Promise<{ id: number }> {
  return apiRequest(`/learning/manage/courses/${courseId}/modules`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function deleteLearningModule(moduleId: number): Promise<void> {
  return apiRequest(`/learning/manage/modules/${moduleId}`, { method: 'DELETE' });
}

export async function deleteLearningLesson(lessonId: number): Promise<void> {
  return apiRequest(`/learning/manage/lessons/${lessonId}`, { method: 'DELETE' });
}

export async function uploadLearningLessons(
  moduleId: number,
  files: File[],
  onProgress?: (pct: number) => void,
): Promise<{ lessons: { id: number; title: string }[] }> {
  const form = new FormData();
  for (const f of files) form.append('files', f);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_BASE}/learning/manage/modules/${moduleId}/lessons`);
    xhr.withCredentials = true;

    if (onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
      };
    }

    xhr.onload = () => {
      let data: unknown = {};
      try {
        data = JSON.parse(xhr.responseText || '{}');
      } catch {
        /* ignore */
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(data as { lessons: { id: number; title: string }[] });
        return;
      }
      const body = data as { error?: { message?: string } };
      reject(new ApiError(body.error?.message ?? 'Error al subir archivos', xhr.status));
    };

    xhr.onerror = () => reject(new ApiError('Error de red al subir archivos', 0));
    xhr.send(form);
  });
}

export async function uploadLearningCover(
  courseId: number,
  file: File,
): Promise<{ coverUrl: string }> {
  const form = new FormData();
  form.append('cover', file);

  const response = await fetch(`${API_BASE}/learning/manage/courses/${courseId}/cover`, {
    method: 'POST',
    body: form,
    credentials: 'include',
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const body = data as { error?: { message?: string } };
    throw new ApiError(body.error?.message ?? 'Error al subir portada', response.status);
  }
  return data as { coverUrl: string };
}
