import { apiRequest } from './client';
import type {
  CorporateEvent,
  CorporateEventFormData,
  CorporateEventListFilters,
  CorporateEventManageFilters,
} from './events.types';

function toQuery(filters: Record<string, string | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value) params.set(key, value);
  }
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export function fetchEvents(filters: CorporateEventListFilters = {}) {
  return apiRequest<{ items: CorporateEvent[] }>(`/events${toQuery({ tab: filters.tab })}`);
}

export function fetchEvent(id: number) {
  return apiRequest<{ item: CorporateEvent }>(`/events/${id}`);
}

export function fetchEventsManage(filters: CorporateEventManageFilters = {}) {
  return apiRequest<{ items: CorporateEvent[] }>(
    `/events/manage${toQuery({ status: filters.status, search: filters.search })}`,
  );
}

export function fetchEventManage(id: number) {
  return apiRequest<{ item: CorporateEvent }>(`/events/manage/${id}`);
}

export function createEvent(data: CorporateEventFormData) {
  return apiRequest<{ item: CorporateEvent }>('/events', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updateEvent(id: number, data: CorporateEventFormData) {
  return apiRequest<{ item: CorporateEvent }>(`/events/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export function publishEvent(id: number) {
  return apiRequest<{ item: CorporateEvent }>(`/events/${id}/publish`, {
    method: 'PATCH',
  });
}

export function cancelEvent(id: number) {
  return apiRequest<{ item: CorporateEvent }>(`/events/${id}/cancel`, {
    method: 'PATCH',
  });
}
