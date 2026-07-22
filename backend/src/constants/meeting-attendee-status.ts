export const MEETING_ATTENDEE_STATUS = {
  PENDING: 'PENDING',
  ACCEPTED: 'ACCEPTED',
  DECLINED: 'DECLINED',
} as const;

export type MeetingAttendeeStatus =
  (typeof MEETING_ATTENDEE_STATUS)[keyof typeof MEETING_ATTENDEE_STATUS];

export const MEETING_ATTENDEE_STATUS_LABELS: Record<MeetingAttendeeStatus, string> = {
  PENDING: 'Pendiente',
  ACCEPTED: 'Aceptó',
  DECLINED: 'Declinó',
};

export const MEETING_ATTENDEE_STATUSES = Object.values(MEETING_ATTENDEE_STATUS);
