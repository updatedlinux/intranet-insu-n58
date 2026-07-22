export type TicketPriority = 'Low' | 'Medium' | 'High' | 'Critical';
export type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'ON_HOLD' | 'RESOLVED' | 'CLOSED';

export interface Ticket {
  id: number;
  code: string;
  title: string;
  description: string;
  categoryId: number;
  categoryName: string;
  priority: TicketPriority;
  priorityLabel: string;
  status: TicketStatus;
  statusLabel: string;
  requesterId: number;
  requesterName: string;
  requesterAreaName: string;
  assignedTo: number | null;
  assigneeName: string | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  closedAt: string | null;
}

export type TicketCommentAuthorRole = 'requester' | 'it_assignee' | 'it_agent';

export interface TicketComment {
  id: number;
  ticketId: number;
  userId: number;
  authorName: string;
  authorAreaName: string;
  authorRole: TicketCommentAuthorRole;
  message: string;
  createdAt: string;
  isOwn: boolean;
}

export interface TicketAttachment {
  id: number;
  ticketId: number;
  fileName: string;
  fileSize: number;
  mimeType: string;
  createdAt: string;
}

export interface TicketCapabilities {
  isItAgent: boolean;
  canManageDesk: boolean;
}

export interface TicketMetrics {
  openCount: number;
  inProgressCount: number;
  avgResolutionHours: number | null;
  byCategory: { categoryId: number; categoryName: string; count: number }[];
}

export interface CreateTicketData {
  title: string;
  description: string;
  categoryId: number;
  priority: TicketPriority;
}

export interface TicketListFilters {
  status?: TicketStatus;
  priority?: TicketPriority;
  categoryId?: number;
  requesterId?: number;
  search?: string;
  activeOnly?: boolean;
  mineOnly?: boolean;
}
