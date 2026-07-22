export type LearningContentType = 'VIDEO' | 'PDF' | 'IMAGE' | 'DOCUMENT';
export type CourseStatus = 'NEW' | 'IN_PROGRESS' | 'COMPLETED';

export interface LearningCourseCard {
  id: number;
  code: string;
  title: string;
  description: string | null;
  coverUrl: string | null;
  totalLessons: number;
  completedLessons: number;
  percent: number;
  status: CourseStatus;
  lastActivityAt: string | null;
}

export interface LearningLessonItem {
  id: number;
  title: string;
  description: string | null;
  contentType: LearningContentType;
  fileName: string | null;
  order: number;
  completed: boolean;
}

export interface LearningModuleItem {
  id: number;
  title: string;
  order: number;
  lessons: LearningLessonItem[];
}

export interface ManageCourseSummary {
  id: number;
  code: string;
  title: string;
  description: string | null;
  coverUrl: string | null;
  isPublished: boolean;
  totalLessons: number;
  areaIds: number[];
  exceptionUserIds: number[];
  updatedAt: string;
}

export interface ManageCourseDetail {
  course: {
    id: number;
    code: string;
    title: string;
    description: string | null;
    coverUrl: string | null;
    isPublished: boolean;
    areaIds: number[];
    exceptionUserIds: number[];
  };
  modules: {
    id: number;
    title: string;
    order: number;
    lessons: {
      id: number;
      title: string;
      description: string | null;
      contentType: LearningContentType;
      fileName: string | null;
      fileSize: number | null;
      order: number;
    }[];
  }[];
}

export interface LearningReportRow {
  userId: number;
  fullName: string;
  email: string;
  areaName: string;
  enrollmentType: 'AREA' | 'EXCEPTION';
  completedLessons: number;
  totalLessons: number;
  percent: number;
  lastActivityAt: string | null;
  completedAt: string | null;
}

export interface LearningUserOption {
  id: number;
  fullName: string;
  email: string;
  areaName: string;
}
