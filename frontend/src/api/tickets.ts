import { ApiError, apiRequest } from './client';
import type {
  CreateTicketData,
  Ticket,
  TicketAttachment,
  TicketCapabilities,
  TicketComment,
  TicketListFilters,
  TicketMetrics,
  TicketPriority,
  TicketStatus,
} from './tickets.types';

const API_BASE = import.meta.env.VITE_API_URL ?? '/api/v1';

function toQuery(filters: TicketListFilters): string {
  const params = new URLSearchParams();
  if (filters.status) params.set('status', filters.status);
  if (filters.priority) params.set('priority', filters.priority);
  if (filters.categoryId != null) params.set('categoryId', String(filters.categoryId));
  if (filters.requesterId != null) params.set('requesterId', String(filters.requesterId));
  if (filters.search?.trim()) params.set('search', filters.search.trim());
  if (filters.activeOnly) params.set('activeOnly', '1');
  if (filters.mineOnly) params.set('mineOnly', '1');
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export function fetchTicketCapabilities() {
  return apiRequest<TicketCapabilities>('/tickets/capabilities');
}

export function fetchTickets(filters: TicketListFilters = {}) {
  return apiRequest<{ items: Ticket[] }>(`/tickets${toQuery(filters)}`);
}

export function fetchTicketMetrics() {
  return apiRequest<TicketMetrics>('/tickets/metrics');
}

export function fetchTicket(id: number) {
  return apiRequest<{ item: Ticket; comments: TicketComment[]; attachments: TicketAttachment[] }>(
    `/tickets/${id}`,
  );
}

export async function createTicket(data: CreateTicketData, files: File[] = []) {
  const formData = new FormData();
  formData.append('title', data.title);
  formData.append('description', data.description);
  formData.append('categoryId', String(data.categoryId));
  formData.append('priority', data.priority);
  for (const file of files) {
    formData.append('files', file);
  }

  const response = await fetch(`${API_BASE}/tickets`, {
    method: 'POST',
    body: formData,
    credentials: 'include',
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message =
      (payload as { error?: { message?: string } }).error?.message ?? 'No se pudo crear el ticket';
    throw new ApiError(message, response.status);
  }

  return payload as { item: Ticket };
}

export function assignTicket(id: number, assignedTo?: number) {
  return apiRequest<{ item: Ticket }>(`/tickets/${id}/assign`, {
    method: 'PATCH',
    body: JSON.stringify(assignedTo != null ? { assignedTo } : {}),
  });
}

export function updateTicketStatus(id: number, status: TicketStatus) {
  return apiRequest<{ item: Ticket }>(`/tickets/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

export function updateTicketPriority(id: number, priority: TicketPriority) {
  return apiRequest<{ item: Ticket }>(`/tickets/${id}/priority`, {
    method: 'PATCH',
    body: JSON.stringify({ priority }),
  });
}

export function addTicketComment(id: number, message: string) {
  return apiRequest<{ comment: TicketComment }>(`/tickets/${id}/comments`, {
    method: 'POST',
    body: JSON.stringify({ message }),
  });
}
