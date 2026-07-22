import type { TaskAssignee, TaskPriority, TaskStatus, TaskTag } from './boards.types';

export interface TaskDetail {
  id: number;
  boardId: number;
  columnId: number;
  title: string;
  description: string | null;
  priority: TaskPriority;
  priorityLabel: string;
  status: TaskStatus;
  statusLabel: string;
  color: string | null;
  dueDate: string | null;
  createdBy: number;
  creatorName: string;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
  completedAt: string | null;
  order: number;
  assignees: TaskAssignee[];
  tags: TaskTag[];
}

export interface TaskComment {
  id: number;
  taskId: number;
  userId: number;
  authorName: string;
  authorAreaName: string;
  message: string;
  createdAt: string;
  isOwn: boolean;
}

export interface TaskAttachment {
  id: number;
  taskId: number;
  fileName: string;
  fileType: string;
  fileSize: number;
  uploadedBy: number;
  uploaderName: string;
  createdAt: string;
}

export interface TaskActivity {
  id: number;
  userId: number;
  authorName: string;
  action: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface CreateTaskData {
  boardId: number;
  columnId: number;
  title: string;
  description?: string | null;
  priority?: TaskPriority;
  color?: string | null;
  dueDate?: string | null;
  assigneeIds?: number[];
  tagIds?: number[];
}

export interface UpdateTaskData {
  title?: string;
  description?: string | null;
  priority?: TaskPriority;
  color?: string | null;
  dueDate?: string | null;
  tagIds?: number[];
}

export interface MoveTaskData {
  columnId: number;
  order: number;
  taskOrders?: { taskId: number; order: number }[];
}

export interface TaskDetailResponse {
  item: TaskDetail;
  comments: TaskComment[];
  attachments: TaskAttachment[];
  activity: TaskActivity[];
}
