export const REQUEST_STATUSES = [
  'SUBMITTED',
  'RECEIVED',
  'IN_PROGRESS',
  'RESOLVED',
  'REJECTED',
  'CLOSED',
] as const;

export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export const REQUEST_STATUS_LABELS: Record<RequestStatus, string> = {
  SUBMITTED: 'Enviada',
  RECEIVED: 'Recibida',
  IN_PROGRESS: 'En progreso',
  RESOLVED: 'Resuelta',
  REJECTED: 'Rechazada',
  CLOSED: 'Cerrada',
};

export const REQUEST_ACTIVE_STATUSES: RequestStatus[] = [
  'SUBMITTED',
  'RECEIVED',
  'IN_PROGRESS',
  'RESOLVED',
];
