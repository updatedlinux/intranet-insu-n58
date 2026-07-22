export type RequestStatus =
  | 'SUBMITTED'
  | 'RECEIVED'
  | 'IN_PROGRESS'
  | 'RESOLVED'
  | 'REJECTED'
  | 'CLOSED';

export type RequestPriority = 'Low' | 'Medium' | 'High';

export interface InternalRequest {
  id: number;
  code: string;
  requesterId: number;
  requesterName: string;
  requesterAreaName: string;
  targetAreaId: number;
  targetAreaName: string;
  title: string;
  description: string;
  category: string | null;
  priority: RequestPriority;
  status: RequestStatus;
  rejectionReason: string | null;
  linkedTaskId: number | null;
  linkedTaskTitle: string | null;
  linkedTaskBoardId: number | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  closedAt: string | null;
}

export interface RequestStatusHistoryItem {
  id: number;
  fromStatus: RequestStatus | null;
  toStatus: RequestStatus;
  comment: string | null;
  changedByName: string;
  createdAt: string;
}

export interface RequestDetailResponse {
  item: InternalRequest;
  history: RequestStatusHistoryItem[];
  capabilities: {
    canManage: boolean;
    canClose: boolean;
  };
}

export interface RequestListResponse {
  items: InternalRequest[];
}

export interface RequestInboxResponse extends RequestListResponse {
  submittedCount: number;
}

export interface TargetAreaOption {
  id: number;
  name: string;
}

export interface CreateRequestData {
  targetAreaId: number;
  title: string;
  description: string;
  category?: string | null;
  priority?: RequestPriority;
}
