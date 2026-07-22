import { apiRequest } from './client';
import type { ChatMessageItem, ChatRoomItem } from './chat.types';

const API_BASE = import.meta.env.VITE_API_URL ?? '/api/v1';

export function chatFileUrl(messageId: number): string {
  return `${API_BASE}/chat/files/${messageId}`;
}

export async function fetchChatRooms(): Promise<{ items: ChatRoomItem[]; totalUnread: number }> {
  return apiRequest('/chat/rooms');
}

export async function fetchChatUnreadCount(): Promise<{ count: number }> {
  return apiRequest('/chat/unread-count');
}

export async function fetchChatMessages(
  roomId: number,
  options?: { beforeId?: number; limit?: number },
): Promise<{ items: ChatMessageItem[]; hasMore: boolean }> {
  const params = new URLSearchParams();
  if (options?.beforeId) params.set('beforeId', String(options.beforeId));
  if (options?.limit) params.set('limit', String(options.limit));
  const qs = params.toString();
  return apiRequest(`/chat/rooms/${roomId}/messages${qs ? `?${qs}` : ''}`);
}

export async function openDirectChat(userId: number): Promise<{ room: ChatRoomItem }> {
  return apiRequest('/chat/rooms/direct', {
    method: 'POST',
    body: JSON.stringify({ userId }),
  });
}

export async function uploadChatFile(
  roomId: number,
  file: File,
): Promise<{ fileUrl: string; fileName: string; fileType: string }> {
  const form = new FormData();
  form.append('file', file);
  form.append('roomId', String(roomId));

  const response = await fetch(`${API_BASE}/chat/upload`, {
    method: 'POST',
    body: form,
    credentials: 'include',
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const body = data as { error?: { message?: string } };
    throw new Error(body.error?.message ?? 'Error al subir archivo');
  }
  return data as { fileUrl: string; fileName: string; fileType: string };
}

export function getSocketUrl(): string {
  const configured = import.meta.env.VITE_SOCKET_URL as string | undefined;
  if (configured?.trim()) {
    return configured.replace(/\/$/, '');
  }
  if (import.meta.env.DEV) {
    return 'http://localhost:3000';
  }
  return window.location.origin;
}
