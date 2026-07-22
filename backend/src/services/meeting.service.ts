import {
  MEETING_ATTENDEE_STATUS,
  MEETING_ATTENDEE_STATUS_LABELS,
  type MeetingAttendeeStatus,
} from '../constants/meeting-attendee-status';
import {
  MEETING_STATUS,
  MEETING_STATUS_LABELS,
  type MeetingStatus,
} from '../constants/meeting-status';
import { isAdminRole } from '../constants/roles';
import type { AppError } from '../middlewares/error.middleware';
import {
  bulkCompleteMeetings,
  findMeetingAttendee,
  findMeetingById,
  findMeetingsToAutoComplete,
  insertMeeting,
  isUserMeetingParticipant,
  listMeetingAttendees,
  listMeetingExternalAttendees,
  listMeetingReminderLog,
  listMeetingsForUser,
  setMeetingAttendees,
  setMeetingExternalAttendees,
  updateMeeting,
  updateMeetingAttendeeStatus,
  type MeetingAttendeeRow,
  type MeetingExternalAttendeeRow,
  type MeetingReminderLogRow,
  type MeetingRow,
} from '../repositories/meeting.repository';
import { findUserById } from '../repositories/user.repository';
import type { AuthenticatedUser } from '../types/auth';
import { displayName } from './email.service';
import { notifyCancelled, notifyCreated, notifyRescheduled } from './meeting-notification.service';

function notFound(message = 'Reunión no encontrada'): AppError {
  const error = new Error(message) as AppError;
  error.statusCode = 404;
  return error;
}

function forbidden(message: string): AppError {
  const error = new Error(message) as AppError;
  error.statusCode = 403;
  return error;
}

function badRequest(message: string): AppError {
  const error = new Error(message) as AppError;
  error.statusCode = 400;
  return error;
}

export interface PublicMeetingAttendee {
  id: number;
  userId: number;
  firstName: string;
  lastName: string;
  fullName: string;
  areaName: string;
  status: MeetingAttendeeStatus;
  statusLabel: string;
  respondedAt: string | null;
}

export interface PublicExternalAttendee {
  id: number;
  name: string;
  email: string | null;
  company: string | null;
}

export interface PublicReminderLogEntry {
  id: number;
  userId: number | null;
  externalEmail: string | null;
  reminderType: string;
  sentAt: string;
}

export interface PublicMeeting {
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
  attendeeCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface PublicMeetingDetail extends PublicMeeting {
  attendees: PublicMeetingAttendee[];
  externalAttendees: PublicExternalAttendee[];
  reminderLog: PublicReminderLogEntry[];
  isOrganizer: boolean;
  currentUserAttendeeStatus: MeetingAttendeeStatus | null;
}

function toPublicAttendee(row: MeetingAttendeeRow): PublicMeetingAttendee {
  return {
    id: row.id,
    userId: row.userId,
    firstName: row.firstName,
    lastName: row.lastName,
    fullName: displayName(row.firstName, row.lastName),
    areaName: row.areaName,
    status: row.status,
    statusLabel: MEETING_ATTENDEE_STATUS_LABELS[row.status],
    respondedAt: row.respondedAt?.toISOString() ?? null,
  };
}

function toPublicExternal(row: MeetingExternalAttendeeRow): PublicExternalAttendee {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    company: row.company,
  };
}

function toPublicReminderLog(row: MeetingReminderLogRow): PublicReminderLogEntry {
  return {
    id: row.id,
    userId: row.userId,
    externalEmail: row.externalEmail,
    reminderType: row.reminderType,
    sentAt: row.sentAt.toISOString(),
  };
}

function toPublicMeeting(row: MeetingRow): PublicMeeting {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    organizerId: row.organizerId,
    organizerName: displayName(row.organizerFirstName, row.organizerLastName),
    startDateTime: row.startDateTime.toISOString(),
    endDateTime: row.endDateTime.toISOString(),
    isRemote: row.isRemote,
    modalityLabel: row.isRemote ? 'Remota' : 'Presencial',
    meetingLink: row.meetingLink,
    location: row.location,
    status: row.status,
    statusLabel: MEETING_STATUS_LABELS[row.status],
    cancellationReason: row.cancellationReason,
    originalStartDateTime: row.originalStartDateTime?.toISOString() ?? null,
    attendeeCount: row.attendeeCount,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function validateMeetingSchedule(input: {
  startDateTime: Date;
  endDateTime: Date;
  isRemote: boolean;
  meetingLink: string | null;
  location: string | null;
  requireFutureStart?: boolean;
}): void {
  if (input.requireFutureStart && input.startDateTime <= new Date()) {
    throw badRequest('La fecha de inicio debe ser futura');
  }
  if (input.endDateTime <= input.startDateTime) {
    throw badRequest('La fecha de fin debe ser posterior a la de inicio');
  }
  if (input.isRemote) {
    if (!input.meetingLink?.trim()) {
      throw badRequest('El enlace de reunión es obligatorio para reuniones remotas');
    }
  } else if (!input.location?.trim()) {
    throw badRequest('La ubicación es obligatoria para reuniones presenciales');
  }
}

async function assertMeetingAccess(
  user: AuthenticatedUser,
  meetingId: number,
): Promise<MeetingRow> {
  const meeting = await findMeetingById(meetingId);
  if (!meeting) throw notFound();

  if (isAdminRole(user.roleName)) return meeting;

  const participant = await isUserMeetingParticipant(meetingId, user.id);
  if (!participant) throw forbidden('No tiene acceso a esta reunión');

  return meeting;
}

async function validateAttendeeUserIds(userIds: number[]): Promise<void> {
  for (const userId of userIds) {
    const user = await findUserById(userId);
    if (!user?.isActive) {
      throw badRequest(`Asistente inválido (userId=${userId})`);
    }
  }
}

export async function createMeetingService(
  user: AuthenticatedUser,
  data: {
    title: string;
    description: string | null;
    startDateTime: Date;
    endDateTime: Date;
    isRemote: boolean;
    meetingLink: string | null;
    location: string | null;
    attendeeIds: number[];
    externalAttendees: { name: string; email: string | null; company: string | null }[];
  },
): Promise<PublicMeetingDetail> {
  validateMeetingSchedule({ ...data, requireFutureStart: true });
  await validateAttendeeUserIds(data.attendeeIds);

  const meetingId = await insertMeeting({
    title: data.title,
    description: data.description,
    organizerId: user.id,
    startDateTime: data.startDateTime,
    endDateTime: data.endDateTime,
    isRemote: data.isRemote,
    meetingLink: data.isRemote ? (data.meetingLink?.trim() ?? null) : null,
    location: data.isRemote ? null : (data.location?.trim() ?? null),
  });

  await setMeetingAttendees(meetingId, data.attendeeIds, user.id);
  await setMeetingExternalAttendees(meetingId, data.externalAttendees);

  const meeting = await findMeetingById(meetingId);
  if (!meeting) throw notFound();

  void notifyCreated({ meeting });

  return getMeetingDetailService(user, meetingId);
}

export async function listMeetingsService(
  user: AuthenticatedUser,
  filters: {
    fromDate?: Date;
    toDate?: Date;
    status?: MeetingStatus;
    tab?: 'upcoming' | 'past';
  },
): Promise<{ items: PublicMeeting[] }> {
  const rows = await listMeetingsForUser({
    userId: user.id,
    ...filters,
  });
  return { items: rows.map(toPublicMeeting) };
}

export async function getMeetingDetailService(
  user: AuthenticatedUser,
  meetingId: number,
): Promise<PublicMeetingDetail> {
  const meeting = await assertMeetingAccess(user, meetingId);
  const [attendees, externalAttendees, reminderLog] = await Promise.all([
    listMeetingAttendees(meetingId),
    listMeetingExternalAttendees(meetingId),
    listMeetingReminderLog(meetingId),
  ]);

  const currentAttendee = attendees.find((a) => a.userId === user.id);

  return {
    ...toPublicMeeting(meeting),
    attendees: attendees.map(toPublicAttendee),
    externalAttendees: externalAttendees.map(toPublicExternal),
    reminderLog: reminderLog.map(toPublicReminderLog),
    isOrganizer: meeting.organizerId === user.id,
    currentUserAttendeeStatus: currentAttendee?.status ?? null,
  };
}

export async function updateMeetingService(
  user: AuthenticatedUser,
  meetingId: number,
  data: {
    title?: string;
    description?: string | null;
    startDateTime?: Date;
    endDateTime?: Date;
    isRemote?: boolean;
    meetingLink?: string | null;
    location?: string | null;
    attendeeIds?: number[];
    externalAttendees?: { name: string; email: string | null; company: string | null }[];
  },
): Promise<PublicMeetingDetail> {
  const meeting = await assertMeetingAccess(user, meetingId);

  if (meeting.organizerId !== user.id) {
    throw forbidden('Solo el organizador puede editar la reunión');
  }

  if (meeting.status !== MEETING_STATUS.SCHEDULED) {
    throw badRequest('Solo se pueden editar reuniones programadas');
  }

  const nextStart = data.startDateTime ?? meeting.startDateTime;
  const nextEnd = data.endDateTime ?? meeting.endDateTime;
  const nextIsRemote = data.isRemote ?? meeting.isRemote;
  const nextMeetingLink =
    data.meetingLink !== undefined ? data.meetingLink : nextIsRemote ? meeting.meetingLink : null;
  const nextLocation =
    data.location !== undefined ? data.location : nextIsRemote ? null : meeting.location;

  validateMeetingSchedule({
    startDateTime: nextStart,
    endDateTime: nextEnd,
    isRemote: nextIsRemote,
    meetingLink: nextMeetingLink,
    location: nextLocation,
    requireFutureStart: true,
  });

  const isReschedule =
    (data.startDateTime !== undefined &&
      data.startDateTime.getTime() !== meeting.startDateTime.getTime()) ||
    (data.endDateTime !== undefined &&
      data.endDateTime.getTime() !== meeting.endDateTime.getTime());

  const previousStartDateTime = meeting.startDateTime;

  if (isReschedule) {
    await updateMeeting(meetingId, {
      status: MEETING_STATUS.RESCHEDULED,
      originalStartDateTime: meeting.originalStartDateTime ?? meeting.startDateTime,
    });
  }

  await updateMeeting(meetingId, {
    title: data.title,
    description: data.description,
    startDateTime: data.startDateTime,
    endDateTime: data.endDateTime,
    isRemote: data.isRemote,
    meetingLink: nextIsRemote ? (nextMeetingLink?.trim() ?? null) : null,
    location: nextIsRemote ? null : (nextLocation?.trim() ?? null),
    status: MEETING_STATUS.SCHEDULED,
  });

  if (data.attendeeIds !== undefined) {
    await validateAttendeeUserIds(data.attendeeIds);
    await setMeetingAttendees(meetingId, data.attendeeIds, meeting.organizerId);
  }

  if (data.externalAttendees !== undefined) {
    await setMeetingExternalAttendees(meetingId, data.externalAttendees);
  }

  const updated = await findMeetingById(meetingId);
  if (!updated) throw notFound();

  if (isReschedule) {
    void notifyRescheduled({ meeting: updated, previousStartDateTime });
  }

  return getMeetingDetailService(user, meetingId);
}

export async function cancelMeetingService(
  user: AuthenticatedUser,
  meetingId: number,
  cancellationReason: string,
): Promise<PublicMeetingDetail> {
  const meeting = await assertMeetingAccess(user, meetingId);

  if (meeting.organizerId !== user.id && !isAdminRole(user.roleName)) {
    throw forbidden('Solo el organizador o un administrador puede cancelar la reunión');
  }

  if (
    meeting.status !== MEETING_STATUS.SCHEDULED &&
    meeting.status !== MEETING_STATUS.RESCHEDULED
  ) {
    throw badRequest('Solo se pueden cancelar reuniones programadas o reprogramadas');
  }

  await updateMeeting(meetingId, {
    status: MEETING_STATUS.CANCELLED,
    cancellationReason: cancellationReason.trim(),
  });

  const updated = await findMeetingById(meetingId);
  if (!updated) throw notFound();

  void notifyCancelled({ meeting: updated });

  return getMeetingDetailService(user, meetingId);
}

export async function respondMeetingService(
  user: AuthenticatedUser,
  meetingId: number,
  targetUserId: number,
  status: MeetingAttendeeStatus,
): Promise<PublicMeetingDetail> {
  if (user.id !== targetUserId && !isAdminRole(user.roleName)) {
    throw forbidden('Solo puede responder a su propia invitación');
  }

  const meeting = await assertMeetingAccess(user, meetingId);

  if (
    meeting.status !== MEETING_STATUS.SCHEDULED &&
    meeting.status !== MEETING_STATUS.RESCHEDULED
  ) {
    throw badRequest('No puede responder a una reunión cancelada o completada');
  }

  const attendee = await findMeetingAttendee(meetingId, targetUserId);
  if (!attendee) throw badRequest('El usuario no es asistente de esta reunión');

  if (status === MEETING_ATTENDEE_STATUS.PENDING) {
    throw badRequest('Estado de respuesta inválido');
  }

  await updateMeetingAttendeeStatus(meetingId, targetUserId, status);

  return getMeetingDetailService(user, meetingId);
}

export async function completeMeetingService(
  user: AuthenticatedUser,
  meetingId: number,
): Promise<PublicMeetingDetail> {
  const meeting = await assertMeetingAccess(user, meetingId);

  if (meeting.organizerId !== user.id && !isAdminRole(user.roleName)) {
    throw forbidden('Solo el organizador o un administrador puede completar la reunión');
  }

  if (
    meeting.status !== MEETING_STATUS.SCHEDULED &&
    meeting.status !== MEETING_STATUS.RESCHEDULED
  ) {
    throw badRequest('La reunión no está activa');
  }

  if (meeting.endDateTime > new Date()) {
    throw badRequest('Solo se puede completar una reunión cuya fecha ya haya pasado');
  }

  await updateMeeting(meetingId, { status: MEETING_STATUS.COMPLETED });

  return getMeetingDetailService(user, meetingId);
}

export async function autoCompletePastMeetings(): Promise<number> {
  const meetings = await findMeetingsToAutoComplete();
  const ids = meetings.map((m) => m.id);
  return bulkCompleteMeetings(ids);
}
