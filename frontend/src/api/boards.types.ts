export type TaskPriority = 'Low' | 'Medium' | 'High' | 'Critical';
export type TaskStatus = 'OPEN' | 'IN_PROGRESS' | 'IN_REVIEW' | 'DONE' | 'ARCHIVED';

export interface BoardSummary {
  id: number;
  areaId: number;
  areaName: string;
  name: string;
  createdAt: string;
}

export interface BoardColumn {
  id: number;
  boardId: number;
  name: string;
  order: number;
  color: string | null;
  defaultStatus: TaskStatus;
}

export interface TaskAssignee {
  userId: number;
  firstName: string;
  lastName: string;
  areaName: string;
}

export interface TaskTag {
  tagId: number;
  tagName: string;
}

export interface TaskCard {
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
  order: number;
  attachmentCount: number;
  assignees: TaskAssignee[];
  tags: TaskTag[];
}

export interface AssignableUser {
  id: number;
  firstName: string;
  lastName: string;
  areaId: number;
  areaName: string;
}

export interface BoardCapabilities {
  canManage: boolean;
  canViewMetrics: boolean;
}

export interface BoardDetail {
  board: BoardSummary;
  columns: BoardColumn[];
  tasks: TaskCard[];
  assignableUsers: AssignableUser[];
  capabilities: BoardCapabilities;
}

export interface BoardMetrics {
  summary: {
    totalTasks: number;
    completed: number;
    inProgress: number;
    overdue: number;
  };
  byColumn: { columnId: number; columnName: string; count: number }[];
  byAssignee: { userId: number; name: string; count: number }[];
  overdueTasks: {
    id: number;
    title: string;
    dueDate: string | null;
    priority: TaskPriority;
    priorityLabel: string;
    columnId: number;
  }[];
  completedLast30Days: number;
  avgCompletionHours: number | null;
}
