export const LEARNING_CONTENT_TYPES = ['VIDEO', 'PDF', 'IMAGE', 'DOCUMENT'] as const;

export type LearningContentType = (typeof LEARNING_CONTENT_TYPES)[number];

export const LEARNING_LESSON_MAX_BYTES = 500 * 1024 * 1024;

export const LEARNING_COVER_MAX_BYTES = 5 * 1024 * 1024;

export function buildLearningObjectKey(courseId: number, fileName: string): string {
  const safe = fileName.replace(/[^\w.\-()]/g, '_');
  const stamp = Date.now();
  return `learning/courses/${courseId}/${stamp}-${safe}`;
}

export function buildLearningCoverKey(courseId: number, fileName: string): string {
  const safe = fileName.replace(/[^\w.\-()]/g, '_');
  return `learning/courses/${courseId}/cover-${Date.now()}-${safe}`;
}
