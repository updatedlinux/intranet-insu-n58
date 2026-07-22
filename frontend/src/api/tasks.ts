import { ApiError, apiRequest } from './client';
import type {
  CreateTaskData,
  MoveTaskData,
  TaskAttachment,
  TaskComment,
  TaskDetail,
  TaskDetailResponse,
  UpdateTaskData,
} from './tasks.types';

const API_BASE = import.meta.env.VITE_API_URL ?? '/api/v1';

export function fetchTask(taskId: number) {
  return apiRequest<TaskDetailResponse>(`/tasks/${taskId}`);
}

export function createTask(data: CreateTaskData) {
  return apiRequest<{ item: TaskDetail }>('/tasks', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updateTask(taskId: number, data: UpdateTaskData) {
  return apiRequest<{ item: TaskDetail }>(`/tasks/${taskId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export function moveTask(taskId: number, data: MoveTaskData) {
  return apiRequest<{ item: TaskDetail }>(`/tasks/${taskId}/move`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export function assignTask(taskId: number, addIds: number[], removeIds: number[] = []) {
  return apiRequest<{ item: TaskDetail }>(`/tasks/${taskId}/assign`, {
    method: 'PATCH',
    body: JSON.stringify({ addIds, removeIds }),
  });
}

export function addTaskComment(taskId: number, message: string) {
  return apiRequest<{ item: TaskComment }>(`/tasks/${taskId}/comments`, {
    method: 'POST',
    body: JSON.stringify({ message }),
  });
}

export function archiveTask(taskId: number) {
  return apiRequest<{ item: TaskDetail }>(`/tasks/${taskId}/archive`, {
    method: 'PATCH',
  });
}

export function deleteTaskAttachment(taskId: number, attachmentId: number) {
  return apiRequest<void>(`/tasks/${taskId}/attachments/${attachmentId}`, {
    method: 'DELETE',
  });
}

export function taskAttachmentDownloadUrl(taskId: number, attachmentId: number): string {
  return `${API_BASE}/tasks/${taskId}/attachments/${attachmentId}/download`;
}

export async function uploadTaskAttachment(taskId: number, file: File): Promise<TaskAttachment> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${API_BASE}/tasks/${taskId}/attachments`, {
    method: 'POST',
    body: formData,
    credentials: 'include',
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message =
      (payload as { error?: { message?: string } }).error?.message ?? 'No se pudo subir el adjunto';
    throw new ApiError(message, response.status);
  }

  return (payload as { item: TaskAttachment }).item;
}
