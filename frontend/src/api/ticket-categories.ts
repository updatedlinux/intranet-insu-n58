import { apiRequest } from './client';
import type { TicketCategory, TicketCategoryFormData } from './ticket-categories.types';

function toQuery(filters?: { name?: string; isActive?: boolean }): string {
  if (!filters) return '';
  const params = new URLSearchParams();
  if (filters.name?.trim()) params.set('name', filters.name.trim());
  if (filters.isActive != null) params.set('isActive', String(filters.isActive));
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export function fetchTicketCategories(filters?: { name?: string; isActive?: boolean }) {
  return apiRequest<{ items: TicketCategory[] }>(`/ticket-categories${toQuery(filters)}`);
}

export function fetchActiveTicketCategories() {
  return fetchTicketCategories({ isActive: true });
}

export function fetchTicketCategory(id: number) {
  return apiRequest<{ item: TicketCategory }>(`/ticket-categories/${id}`);
}

export function createTicketCategory(data: TicketCategoryFormData) {
  return apiRequest<{ item: TicketCategory }>('/ticket-categories', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updateTicketCategory(id: number, data: TicketCategoryFormData) {
  return apiRequest<{ item: TicketCategory }>(`/ticket-categories/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export function toggleTicketCategoryStatus(id: number, isActive: boolean) {
  return apiRequest<{ item: TicketCategory }>(`/ticket-categories/${id}/toggle`, {
    method: 'PATCH',
    body: JSON.stringify({ isActive }),
  });
}

export function deleteTicketCategory(id: number) {
  return apiRequest<void>(`/ticket-categories/${id}`, { method: 'DELETE' });
}
