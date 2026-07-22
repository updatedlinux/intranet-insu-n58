import { ApiError, apiRequest } from './client';
import type { Collaborator } from './collaborators.types';

const API_BASE = import.meta.env.VITE_API_URL ?? '/api/v1';

export interface AvatarUploadResponse {
  avatarUrl: string;
  collaborator: Collaborator;
}

export async function uploadUserAvatar(userId: number, file: File): Promise<AvatarUploadResponse> {
  const formData = new FormData();
  formData.append('avatar', file);

  const response = await fetch(`${API_BASE}/users/${userId}/avatar`, {
    method: 'POST',
    body: formData,
    credentials: 'include',
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message =
      (data as { error?: { message?: string } }).error?.message ?? 'No se pudo subir el avatar';
    throw new ApiError(message, response.status);
  }

  return data as AvatarUploadResponse;
}

export async function deleteUserAvatar(userId: number): Promise<{ collaborator: Collaborator }> {
  return apiRequest<{ collaborator: Collaborator }>(`/users/${userId}/avatar`, {
    method: 'DELETE',
  });
}
