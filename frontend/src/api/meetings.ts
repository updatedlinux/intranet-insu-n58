import { apiRequest } from './client';
import type {
  CreateMeetingData,
  MeetingAttendeeStatus,
  MeetingDetail,
  MeetingListFilters,
  MeetingListItem,
  UpdateMeetingData,
} from './meetings.types';

function toQuery(filters: MeetingListFilters): string {
  const params = new URLSearchParams();
  if (filters.tab) params.set('tab', filters.tab);
  if (filters.status) params.set('status', filters.status);
  if (filters.from) params.set('from', filters.from);
  if (filters.to) params.set('to', filters.to);
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export function fetchMeetings(filters: MeetingListFilters = {}) {
  return apiRequest<{ items: MeetingListItem[] }>(`/meetings${toQuery(filters)}`);
}

export function fetchMeeting(id: number) {
  return apiRequest<{ item: MeetingDetail }>(`/meetings/${id}`);
}

export function createMeeting(data: CreateMeetingData) {
  return apiRequest<{ item: MeetingDetail }>('/meetings', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updateMeeting(id: number, data: UpdateMeetingData) {
  return apiRequest<{ item: MeetingDetail }>(`/meetings/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export function cancelMeeting(id: number, cancellationReason: string) {
  return apiRequest<{ item: MeetingDetail }>(`/meetings/${id}/cancel`, {
    method: 'PATCH',
    body: JSON.stringify({ cancellationReason }),
  });
}

export function respondToMeeting(id: number, userId: number, status: MeetingAttendeeStatus) {
  return apiRequest<{ item: MeetingDetail }>(`/meetings/${id}/attendees/${userId}/respond`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

export function completeMeeting(id: number) {
  return apiRequest<{ item: MeetingDetail }>(`/meetings/${id}/complete`, {
    method: 'PATCH',
  });
}
