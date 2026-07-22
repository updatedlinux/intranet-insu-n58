import type { RequestPriority, RequestStatus } from '../../api/requests.types';

const STATUS_LABELS: Record<RequestStatus, string> = {
  SUBMITTED: 'Enviada',
  RECEIVED: 'Recibida',
  IN_PROGRESS: 'En proceso',
  RESOLVED: 'Resuelta',
  REJECTED: 'Rechazada',
  CLOSED: 'Cerrada',
};

const PRIORITY_LABELS: Record<RequestPriority, string> = {
  Low: 'Baja',
  Medium: 'Media',
  High: 'Alta',
};

export function RequestStatusBadge({ status }: { status: RequestStatus }) {
  return (
    <span className={`req-badge req-badge--status req-badge--${status.toLowerCase()}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}

export function RequestPriorityBadge({ priority }: { priority: RequestPriority }) {
  return (
    <span className={`req-badge req-badge--priority req-badge--${priority.toLowerCase()}`}>
      {PRIORITY_LABELS[priority]}
    </span>
  );
}

export function requestStatusLabel(status: RequestStatus): string {
  return STATUS_LABELS[status];
}
