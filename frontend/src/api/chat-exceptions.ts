import { apiRequest } from './client';
import type {
  ChatAreaAccessFilters,
  ChatAreaAccessFormData,
  ChatAreaAccessGrant,
  ChatAreaAccessListResponse,
} from './chat-exceptions.types';

function toQuery(filters: ChatAreaAccessFilters): string {
  const params = new URLSearchParams();
  if (filters.userId != null) params.set('userId', String(filters.userId));
  if (filters.areaId != null) params.set('areaId', String(filters.areaId));
  if (filters.isActive != null) params.set('isActive', String(filters.isActive));
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export function fetchChatExceptionsList(filters: ChatAreaAccessFilters = {}) {
  return apiRequest<ChatAreaAccessListResponse>(`/chat-exceptions${toQuery(filters)}`);
}

export function fetchChatException(id: number) {
  return apiRequest<{ item: ChatAreaAccessGrant }>(`/chat-exceptions/${id}`);
}

export function createChatException(data: ChatAreaAccessFormData) {
  return apiRequest<{ item: ChatAreaAccessGrant }>('/chat-exceptions', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updateChatException(id: number, data: ChatAreaAccessFormData) {
  return apiRequest<{ item: ChatAreaAccessGrant }>(`/chat-exceptions/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export function deleteChatException(id: number) {
  return apiRequest<void>(`/chat-exceptions/${id}`, { method: 'DELETE' });
}
