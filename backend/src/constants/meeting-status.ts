export const MEETING_STATUS = {
  SCHEDULED: 'SCHEDULED',
  CANCELLED: 'CANCELLED',
  RESCHEDULED: 'RESCHEDULED',
  COMPLETED: 'COMPLETED',
} as const;

export type MeetingStatus = (typeof MEETING_STATUS)[keyof typeof MEETING_STATUS];

export const MEETING_STATUS_LABELS: Record<MeetingStatus, string> = {
  SCHEDULED: 'Programada',
  CANCELLED: 'Cancelada',
  RESCHEDULED: 'Reprogramada',
  COMPLETED: 'Completada',
};

export const MEETING_STATUSES = Object.values(MEETING_STATUS);
