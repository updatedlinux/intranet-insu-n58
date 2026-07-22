import { NOTIFICATION_RESOURCE_TYPES, NOTIFICATION_TYPES } from '../constants/notification-type';
import {
  MEETING_REMINDER_TYPE,
  type MeetingReminderType,
} from '../constants/meeting-reminder-type';
import {
  insertReminderLog,
  listMeetingAttendees,
  listMeetingExternalAttendees,
  type MeetingRow,
} from '../repositories/meeting.repository';
import { findUserById } from '../repositories/user.repository';
import { displayName, emailService, notifyEmail } from './email.service';
import { createNotificationsForUsers } from './notification.service';

function formatDateTime(date: Date): string {
  return date.toLocaleString('es-ES', {
    dateStyle: 'full',
    timeStyle: 'short',
    timeZone: 'UTC',
  });
}

function modalityLabel(meeting: MeetingRow): string {
  return meeting.isRemote ? 'Remota' : 'Presencial';
}

function locationOrLinkSummary(meeting: MeetingRow): string {
  if (meeting.isRemote) {
    return meeting.meetingLink ? 'Enlace de reunión remota' : 'Reunión remota';
  }
  return meeting.location ?? 'Ubicación por confirmar';
}

export interface MeetingNotificationContext {
  meeting: MeetingRow;
  previousStartDateTime?: Date | null;
}

async function emailInternalAttendees(
  meeting: MeetingRow,
  sendFn: (email: string, name: string) => Promise<boolean>,
  reminderType: MeetingReminderType,
): Promise<void> {
  const attendees = await listMeetingAttendees(meeting.id);
  for (const attendee of attendees) {
    const user = await findUserById(attendee.userId);
    if (!user?.email) continue;

    notifyEmail(async () => {
      const sent = await sendFn(user.email, displayName(user.firstName, user.lastName));
      if (sent) {
        await insertReminderLog({
          meetingId: meeting.id,
          userId: attendee.userId,
          reminderType,
        });
      }
      return sent;
    }, `meeting-${reminderType}-user-${attendee.userId}`);
  }
}

async function emailExternalAttendees(
  meeting: MeetingRow,
  sendFn: (email: string, name: string) => Promise<boolean>,
  reminderType: MeetingReminderType,
): Promise<void> {
  const externals = await listMeetingExternalAttendees(meeting.id);
  for (const external of externals) {
    if (!external.email?.trim()) continue;
    const email = external.email.trim();

    notifyEmail(async () => {
      const sent = await sendFn(email, external.name);
      if (sent) {
        await insertReminderLog({
          meetingId: meeting.id,
          externalEmail: email,
          reminderType,
        });
      }
      return sent;
    }, `meeting-${reminderType}-external-${email}`);
  }
}

export async function notifyCreated(ctx: MeetingNotificationContext): Promise<void> {
  const { meeting } = ctx;
  const attendees = await listMeetingAttendees(meeting.id);
  const attendeeIds = attendees.map((a) => a.userId);
  const organizerName = displayName(meeting.organizerFirstName, meeting.organizerLastName);
  const summary = `${formatDateTime(meeting.startDateTime)} — ${modalityLabel(meeting)}`;

  await createNotificationsForUsers(
    attendeeIds,
    NOTIFICATION_TYPES.MEETING_CREATED,
    'Nueva reunión',
    `${meeting.title} — ${summary} (organiza ${organizerName})`,
    NOTIFICATION_RESOURCE_TYPES.MEETING,
    meeting.id,
  );

  await emailInternalAttendees(
    meeting,
    (email, name) =>
      emailService.sendMeetingCreated(
        email,
        name,
        meeting.title,
        formatDateTime(meeting.startDateTime),
        modalityLabel(meeting),
        locationOrLinkSummary(meeting),
        meeting.id,
      ),
    MEETING_REMINDER_TYPE.CREATED,
  );

  await emailExternalAttendees(
    meeting,
    (email, name) =>
      emailService.sendMeetingCreated(
        email,
        name,
        meeting.title,
        formatDateTime(meeting.startDateTime),
        modalityLabel(meeting),
        locationOrLinkSummary(meeting),
        meeting.id,
      ),
    MEETING_REMINDER_TYPE.CREATED,
  );
}

export async function notifyRescheduled(ctx: MeetingNotificationContext): Promise<void> {
  const { meeting, previousStartDateTime } = ctx;
  const attendees = await listMeetingAttendees(meeting.id);
  const attendeeIds = attendees.map((a) => a.userId);
  const oldDate = previousStartDateTime ?? meeting.originalStartDateTime;
  const oldLabel = oldDate ? formatDateTime(oldDate) : 'fecha anterior';
  const newLabel = formatDateTime(meeting.startDateTime);

  await createNotificationsForUsers(
    attendeeIds,
    NOTIFICATION_TYPES.MEETING_RESCHEDULED,
    'Reunión reprogramada',
    `${meeting.title}: ${oldLabel} → ${newLabel}`,
    NOTIFICATION_RESOURCE_TYPES.MEETING,
    meeting.id,
  );

  await emailInternalAttendees(
    meeting,
    (email, name) =>
      emailService.sendMeetingRescheduled(
        email,
        name,
        meeting.title,
        oldLabel,
        newLabel,
        modalityLabel(meeting),
        locationOrLinkSummary(meeting),
        meeting.id,
      ),
    MEETING_REMINDER_TYPE.RESCHEDULED,
  );

  await emailExternalAttendees(
    meeting,
    (email, name) =>
      emailService.sendMeetingRescheduled(
        email,
        name,
        meeting.title,
        oldLabel,
        newLabel,
        modalityLabel(meeting),
        locationOrLinkSummary(meeting),
        meeting.id,
      ),
    MEETING_REMINDER_TYPE.RESCHEDULED,
  );
}

export async function notifyCancelled(ctx: MeetingNotificationContext): Promise<void> {
  const { meeting } = ctx;
  const attendees = await listMeetingAttendees(meeting.id);
  const attendeeIds = attendees.map((a) => a.userId);
  const reason = meeting.cancellationReason ?? 'Sin motivo especificado';

  await createNotificationsForUsers(
    attendeeIds,
    NOTIFICATION_TYPES.MEETING_CANCELLED,
    'Reunión cancelada',
    `${meeting.title} — ${reason}`,
    NOTIFICATION_RESOURCE_TYPES.MEETING,
    meeting.id,
  );

  await emailInternalAttendees(
    meeting,
    (email, name) =>
      emailService.sendMeetingCancelled(
        email,
        name,
        meeting.title,
        formatDateTime(meeting.startDateTime),
        reason,
        meeting.id,
      ),
    MEETING_REMINDER_TYPE.CANCELLED,
  );

  await emailExternalAttendees(
    meeting,
    (email, name) =>
      emailService.sendMeetingCancelled(
        email,
        name,
        meeting.title,
        formatDateTime(meeting.startDateTime),
        reason,
        meeting.id,
      ),
    MEETING_REMINDER_TYPE.CANCELLED,
  );
}

export async function notifyReminder(
  ctx: MeetingNotificationContext,
  type: typeof MEETING_REMINDER_TYPE.REMINDER_24H | typeof MEETING_REMINDER_TYPE.REMINDER_1H,
): Promise<void> {
  const { meeting } = ctx;
  const attendees = await listMeetingAttendees(meeting.id);
  const attendeeIds = attendees.map((a) => a.userId);
  const hoursLabel = type === MEETING_REMINDER_TYPE.REMINDER_24H ? '24 horas' : '1 hora';
  const summary = `${formatDateTime(meeting.startDateTime)} — ${modalityLabel(meeting)}`;

  await insertReminderLog({
    meetingId: meeting.id,
    reminderType: type,
  });

  await createNotificationsForUsers(
    attendeeIds,
    NOTIFICATION_TYPES.MEETING_REMINDER,
    `Recordatorio de reunión (${hoursLabel})`,
    `${meeting.title} — ${summary}`,
    NOTIFICATION_RESOURCE_TYPES.MEETING,
    meeting.id,
  );

  if (type === MEETING_REMINDER_TYPE.REMINDER_24H) {
    await emailInternalAttendees(
      meeting,
      (email, name) =>
        emailService.sendMeetingReminder(
          email,
          name,
          meeting.title,
          formatDateTime(meeting.startDateTime),
          modalityLabel(meeting),
          locationOrLinkSummary(meeting),
          hoursLabel,
          meeting.id,
        ),
      MEETING_REMINDER_TYPE.REMINDER_24H,
    );

    await emailExternalAttendees(
      meeting,
      (email, name) =>
        emailService.sendMeetingReminder(
          email,
          name,
          meeting.title,
          formatDateTime(meeting.startDateTime),
          modalityLabel(meeting),
          locationOrLinkSummary(meeting),
          hoursLabel,
          meeting.id,
        ),
      MEETING_REMINDER_TYPE.REMINDER_24H,
    );
  }
}
