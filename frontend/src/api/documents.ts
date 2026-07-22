import { ApiError, apiRequest } from './client';
import type { DocDocument, DocFolder, FolderBrowseResponse } from './documents.types';

const API_BASE = import.meta.env.VITE_API_URL ?? '/api/v1';

export interface BrowseFolderFilters {
  q?: string;
  tagIds?: number[];
}

export function browseFolder(folderId?: number, filters: BrowseFolderFilters = {}) {
  const params = new URLSearchParams();
  if (filters.q?.trim()) params.set('q', filters.q.trim());
  if (filters.tagIds?.length) params.set('tagIds', filters.tagIds.join(','));
  const qs = params.toString();
  const base = folderId != null ? `/docs/folders/${folderId}` : '/docs/folders';
  return apiRequest<FolderBrowseResponse>(`${base}${qs ? `?${qs}` : ''}`);
}

export function fetchPendingDocuments() {
  return apiRequest<{ items: DocDocument[] }>('/docs/pending');
}

export function fetchRejectedDocuments() {
  return apiRequest<{ items: DocDocument[] }>('/docs/rejected');
}

export function fetchMyUploads() {
  return apiRequest<{ items: DocDocument[] }>('/docs/my-uploads');
}

export function approveDocument(documentId: number) {
  return apiRequest<{ document: DocDocument }>(`/docs/${documentId}/approve`, { method: 'POST' });
}

export function rejectDocument(documentId: number, reason?: string | null) {
  return apiRequest<{ document: DocDocument }>(`/docs/${documentId}/reject`, {
    method: 'POST',
    body: JSON.stringify({ reason: reason ?? null }),
  });
}

export function createDocFolder(data: {
  name: string;
  description?: string | null;
  parentFolderId: number;
  areaId?: number | null;
}) {
  return apiRequest<{ folder: DocFolder }>('/docs/folders', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function deleteDocFolder(folderId: number) {
  return apiRequest<void>(`/docs/folders/${folderId}`, { method: 'DELETE' });
}

export function deleteDocument(documentId: number) {
  return apiRequest<void>(`/docs/${documentId}`, { method: 'DELETE' });
}

export async function uploadDocument(formData: FormData) {
  const response = await fetch(`${API_BASE}/docs/upload`, {
    method: 'POST',
    body: formData,
    credentials: 'include',
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message =
      (data as { error?: { message?: string } }).error?.message ?? 'No se pudo subir el documento';
    throw new ApiError(message, response.status);
  }

  return data as { document: DocDocument };
}
