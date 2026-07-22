export type MeetingStatus = 'SCHEDULED' | 'CANCELLED' | 'RESCHEDULED' | 'COMPLETED';

export type MeetingAttendeeStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED';

export type MeetingReminderType =
  | 'CREATED'
  | 'REMINDER_24H'
  | 'REMINDER_1H'
  | 'CANCELLED'
  | 'RESCHEDULED';

export type MeetingListTab = 'upcoming' | 'past';

export const MEETING_STATUS_LABELS: Record<MeetingStatus, string> = {
  SCHEDULED: 'Programada',
  CANCELLED: 'Cancelada',
  RESCHEDULED: 'Reprogramada',
  COMPLETED: 'Completada',
};

export const MEETING_ATTENDEE_STATUS_LABELS: Record<MeetingAttendeeStatus, string> = {
  PENDING: 'Pendiente',
  ACCEPTED: 'Aceptó',
  DECLINED: 'Declinó',
};

export interface MeetingListItem {
  id: number;
  title: string;
  startDateTime: string;
  endDateTime: string;
  isRemote: boolean;
  modalityLabel: string;
  status: MeetingStatus;
  statusLabel: string;
  attendeeCount: number;
  organizerId: number;
  organizerName: string;
  isOrganizer: boolean;
}

export interface MeetingInternalAttendee {
  id: number;
  userId: number;
  firstName: string;
  lastName: string;
  fullName: string;
  areaName: string;
  avatarUrl: string | null;
  status: MeetingAttendeeStatus;
  statusLabel: string;
  respondedAt: string | null;
}

export interface MeetingExternalAttendee {
  id: number;
  name: string;
  email: string | null;
  company: string | null;
}

export interface MeetingReminderLogEntry {
  id: number;
  reminderType: MeetingReminderType;
  reminderTypeLabel: string;
  userId: number | null;
  externalEmail: string | null;
  sentAt: string;
}

export interface MeetingDetail {
  id: number;
  title: string;
  description: string | null;
  organizerId: number;
  organizerName: string;
  startDateTime: string;
  endDateTime: string;
  isRemote: boolean;
  modalityLabel: string;
  meetingLink: string | null;
  location: string | null;
  status: MeetingStatus;
  statusLabel: string;
  cancellationReason: string | null;
  originalStartDateTime: string | null;
  createdAt: string;
  updatedAt: string;
  internalAttendees: MeetingInternalAttendee[];
  externalAttendees: MeetingExternalAttendee[];
  reminderLog: MeetingReminderLogEntry[];
  isOrganizer: boolean;
  isInternalAttendee: boolean;
  myAttendeeStatus: MeetingAttendeeStatus | null;
  canEdit: boolean;
  canCancel: boolean;
  canComplete: boolean;
  canRespond: boolean;
}

export interface MeetingExternalAttendeeInput {
  name: string;
  email?: string | null;
  company?: string | null;
}

export interface CreateMeetingData {
  title: string;
  description?: string | null;
  startDateTime: string;
  endDateTime: string;
  isRemote: boolean;
  meetingLink?: string | null;
  location?: string | null;
  internalAttendeeIds: number[];
  externalAttendees: MeetingExternalAttendeeInput[];
}

export type UpdateMeetingData = CreateMeetingData;

export interface MeetingListFilters {
  tab?: MeetingListTab;
  status?: MeetingStatus;
  from?: string;
  to?: string;
}
