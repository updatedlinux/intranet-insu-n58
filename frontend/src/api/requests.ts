import { apiRequest } from './client';
import type {
  CreateRequestData,
  InternalRequest,
  RequestDetailResponse,
  RequestInboxResponse,
  RequestListResponse,
  RequestPriority,
  RequestStatus,
  TargetAreaOption,
} from './requests.types';

function toQuery(params: Record<string, string | number | undefined>): string {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') qs.set(key, String(value));
  }
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export function fetchTargetAreas() {
  return apiRequest<{ items: TargetAreaOption[] }>('/requests/target-areas');
}

export function createRequest(data: CreateRequestData) {
  return apiRequest<{ item: InternalRequest }>('/requests', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function fetchMyRequests(filters?: {
  status?: RequestStatus;
  targetAreaId?: number;
  from?: string;
  to?: string;
}) {
  return apiRequest<RequestListResponse>(`/requests/mine${toQuery(filters ?? {})}`);
}

export function fetchInboxRequests(filters?: {
  status?: RequestStatus;
  priority?: RequestPriority;
  requesterId?: number;
}) {
  return apiRequest<RequestInboxResponse>(`/requests/inbox${toQuery(filters ?? {})}`);
}

export function fetchRequest(id: number) {
  return apiRequest<RequestDetailResponse>(`/requests/${id}`);
}

export function updateRequestStatus(
  id: number,
  data: { status: RequestStatus; comment?: string | null; rejectionReason?: string | null },
) {
  return apiRequest<RequestDetailResponse>(`/requests/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export function linkRequestTask(id: number, linkedTaskId: number) {
  return apiRequest<{
    item: InternalRequest;
    linkedTask: { id: number; title: string; boardId: number };
  }>(`/requests/${id}/link-task`, {
    method: 'PATCH',
    body: JSON.stringify({ linkedTaskId }),
  });
}
