import sql from 'mssql';
import { getPool } from '../config/database';
import type { MeetingAttendeeStatus } from '../constants/meeting-attendee-status';
import type { MeetingReminderType } from '../constants/meeting-reminder-type';
import type { MeetingStatus } from '../constants/meeting-status';

export interface MeetingRow {
  id: number;
  title: string;
  description: string | null;
  organizerId: number;
  organizerFirstName: string;
  organizerLastName: string;
  startDateTime: Date;
  endDateTime: Date;
  isRemote: boolean;
  meetingLink: string | null;
  location: string | null;
  status: MeetingStatus;
  cancellationReason: string | null;
  originalStartDateTime: Date | null;
  createdAt: Date;
  updatedAt: Date;
  attendeeCount: number;
}

export interface MeetingAttendeeRow {
  id: number;
  meetingId: number;
  userId: number;
  firstName: string;
  lastName: string;
  areaName: string;
  status: MeetingAttendeeStatus;
  respondedAt: Date | null;
}

export interface MeetingExternalAttendeeRow {
  id: number;
  meetingId: number;
  name: string;
  email: string | null;
  company: string | null;
}

export interface MeetingReminderLogRow {
  id: number;
  meetingId: number;
  userId: number | null;
  externalEmail: string | null;
  reminderType: MeetingReminderType;
  sentAt: Date;
}

export interface MeetingListFilters {
  userId: number;
  fromDate?: Date;
  toDate?: Date;
  status?: MeetingStatus;
  tab?: 'upcoming' | 'past';
}

const MEETING_SELECT = `
  m.id,
  m.title,
  m.description,
  m.organizerId,
  org.firstName AS organizerFirstName,
  org.lastName AS organizerLastName,
  m.startDateTime,
  m.endDateTime,
  m.isRemote,
  m.meetingLink,
  m.location,
  m.status,
  m.cancellationReason,
  m.originalStartDateTime,
  m.createdAt,
  m.updatedAt,
  (
    SELECT COUNT(*)
    FROM dbo.MeetingAttendees ma
    WHERE ma.meetingId = m.id
  ) AS attendeeCount
`;

const MEETING_FROM = `
  FROM dbo.Meetings m
  INNER JOIN dbo.Users org ON m.organizerId = org.id
`;

function mapMeetingRow(row: MeetingRow): MeetingRow {
  return {
    ...row,
    isRemote: Boolean(row.isRemote),
    attendeeCount: Number(row.attendeeCount ?? 0),
  };
}

export async function insertMeeting(input: {
  title: string;
  description: string | null;
  organizerId: number;
  startDateTime: Date;
  endDateTime: Date;
  isRemote: boolean;
  meetingLink: string | null;
  location: string | null;
}): Promise<number> {
  const pool = getPool();
  const result = await pool
    .request()
    .input('title', sql.NVarChar(300), input.title)
    .input('description', sql.NVarChar(sql.MAX), input.description)
    .input('organizerId', sql.Int, input.organizerId)
    .input('startDateTime', sql.DateTime2, input.startDateTime)
    .input('endDateTime', sql.DateTime2, input.endDateTime)
    .input('isRemote', sql.Bit, input.isRemote ? 1 : 0)
    .input('meetingLink', sql.NVarChar(500), input.meetingLink)
    .input('location', sql.NVarChar(300), input.location).query<{ id: number }>(`
      INSERT INTO dbo.Meetings (
        title, description, organizerId, startDateTime, endDateTime,
        isRemote, meetingLink, location, status
      )
      OUTPUT INSERTED.id
      VALUES (
        @title, @description, @organizerId, @startDateTime, @endDateTime,
        @isRemote, @meetingLink, @location, N'SCHEDULED'
      )
    `);
  return result.recordset[0]!.id;
}

export async function updateMeeting(
  meetingId: number,
  input: {
    title?: string;
    description?: string | null;
    startDateTime?: Date;
    endDateTime?: Date;
    isRemote?: boolean;
    meetingLink?: string | null;
    location?: string | null;
    status?: MeetingStatus;
    cancellationReason?: string | null;
    originalStartDateTime?: Date | null;
  },
): Promise<void> {
  const pool = getPool();
  const sets: string[] = ['updatedAt = SYSUTCDATETIME()'];
  const request = pool.request().input('meetingId', sql.Int, meetingId);

  if (input.title !== undefined) {
    sets.push('title = @title');
    request.input('title', sql.NVarChar(300), input.title);
  }
  if (input.description !== undefined) {
    sets.push('description = @description');
    request.input('description', sql.NVarChar(sql.MAX), input.description);
  }
  if (input.startDateTime !== undefined) {
    sets.push('startDateTime = @startDateTime');
    request.input('startDateTime', sql.DateTime2, input.startDateTime);
  }
  if (input.endDateTime !== undefined) {
    sets.push('endDateTime = @endDateTime');
    request.input('endDateTime', sql.DateTime2, input.endDateTime);
  }
  if (input.isRemote !== undefined) {
    sets.push('isRemote = @isRemote');
    request.input('isRemote', sql.Bit, input.isRemote ? 1 : 0);
  }
  if (input.meetingLink !== undefined) {
    sets.push('meetingLink = @meetingLink');
    request.input('meetingLink', sql.NVarChar(500), input.meetingLink);
  }
  if (input.location !== undefined) {
    sets.push('location = @location');
    request.input('location', sql.NVarChar(300), input.location);
  }
  if (input.status !== undefined) {
    sets.push('status = @status');
    request.input('status', sql.NVarChar(20), input.status);
  }
  if (input.cancellationReason !== undefined) {
    sets.push('cancellationReason = @cancellationReason');
    request.input('cancellationReason', sql.NVarChar(500), input.cancellationReason);
  }
  if (input.originalStartDateTime !== undefined) {
    sets.push('originalStartDateTime = @originalStartDateTime');
    request.input('originalStartDateTime', sql.DateTime2, input.originalStartDateTime);
  }

  await request.query(`
    UPDATE dbo.Meetings
    SET ${sets.join(', ')}
    WHERE id = @meetingId
  `);
}

export async function findMeetingById(meetingId: number): Promise<MeetingRow | null> {
  const pool = getPool();
  const result = await pool.request().input('meetingId', sql.Int, meetingId).query<MeetingRow>(`
    SELECT ${MEETING_SELECT}
    ${MEETING_FROM}
    WHERE m.id = @meetingId
  `);
  const row = result.recordset[0];
  return row ? mapMeetingRow(row) : null;
}

export async function findMeetingDetailById(meetingId: number): Promise<MeetingRow | null> {
  return findMeetingById(meetingId);
}

export async function listMeetingsForUser(filters: MeetingListFilters): Promise<MeetingRow[]> {
  const pool = getPool();
  const request = pool.request().input('userId', sql.Int, filters.userId);

  const conditions = [
    `(m.organizerId = @userId OR EXISTS (
      SELECT 1 FROM dbo.MeetingAttendees ma
      WHERE ma.meetingId = m.id AND ma.userId = @userId
    ))`,
  ];

  if (filters.status) {
    request.input('status', sql.NVarChar(20), filters.status);
    conditions.push('m.status = @status');
  }

  if (filters.fromDate) {
    request.input('fromDate', sql.DateTime2, filters.fromDate);
    conditions.push('m.startDateTime >= @fromDate');
  }

  if (filters.toDate) {
    request.input('toDate', sql.DateTime2, filters.toDate);
    conditions.push('m.startDateTime <= @toDate');
  }

  if (filters.tab === 'upcoming') {
    conditions.push(`m.status IN (N'SCHEDULED', N'RESCHEDULED')`);
    conditions.push('m.endDateTime >= SYSUTCDATETIME()');
  } else if (filters.tab === 'past') {
    conditions.push(`(
      m.status IN (N'COMPLETED', N'CANCELLED')
      OR m.endDateTime < SYSUTCDATETIME()
    )`);
  }

  const result = await request.query<MeetingRow>(`
    SELECT ${MEETING_SELECT}
    ${MEETING_FROM}
    WHERE ${conditions.join(' AND ')}
    ORDER BY m.startDateTime ASC
  `);

  return result.recordset.map(mapMeetingRow);
}

export async function deleteMeeting(meetingId: number): Promise<void> {
  const pool = getPool();
  await pool.request().input('meetingId', sql.Int, meetingId).query(`
    DELETE FROM dbo.Meetings WHERE id = @meetingId
  `);
}

export async function insertMeetingAttendee(
  meetingId: number,
  userId: number,
  status: MeetingAttendeeStatus = 'PENDING',
): Promise<number> {
  const pool = getPool();
  const result = await pool
    .request()
    .input('meetingId', sql.Int, meetingId)
    .input('userId', sql.Int, userId)
    .input('status', sql.NVarChar(20), status)
    .input('respondedAt', sql.DateTime2, status === 'PENDING' ? null : new Date()).query<{
    id: number;
  }>(`
      INSERT INTO dbo.MeetingAttendees (meetingId, userId, status, respondedAt)
      OUTPUT INSERTED.id
      VALUES (@meetingId, @userId, @status, @respondedAt)
    `);
  return result.recordset[0]!.id;
}

export async function setMeetingAttendees(
  meetingId: number,
  userIds: number[],
  organizerId: number,
): Promise<void> {
  const pool = getPool();
  const uniqueIds = [...new Set(userIds.filter((id) => id > 0))];
  if (!uniqueIds.includes(organizerId)) {
    uniqueIds.push(organizerId);
  }

  await pool.request().input('meetingId', sql.Int, meetingId).query(`
    DELETE FROM dbo.MeetingAttendees WHERE meetingId = @meetingId
  `);

  for (const userId of uniqueIds) {
    const status: MeetingAttendeeStatus = userId === organizerId ? 'ACCEPTED' : 'PENDING';
    await insertMeetingAttendee(meetingId, userId, status);
  }
}

export async function listMeetingAttendees(meetingId: number): Promise<MeetingAttendeeRow[]> {
  const pool = getPool();
  const result = await pool.request().input('meetingId', sql.Int, meetingId)
    .query<MeetingAttendeeRow>(`
    SELECT
      ma.id,
      ma.meetingId,
      ma.userId,
      u.firstName,
      u.lastName,
      a.name AS areaName,
      ma.status,
      ma.respondedAt
    FROM dbo.MeetingAttendees ma
    INNER JOIN dbo.Users u ON ma.userId = u.id
    INNER JOIN dbo.Areas a ON u.areaId = a.id
    WHERE ma.meetingId = @meetingId
    ORDER BY u.lastName, u.firstName
  `);
  return result.recordset;
}

export async function findMeetingAttendee(
  meetingId: number,
  userId: number,
): Promise<MeetingAttendeeRow | null> {
  const pool = getPool();
  const result = await pool
    .request()
    .input('meetingId', sql.Int, meetingId)
    .input('userId', sql.Int, userId).query<MeetingAttendeeRow>(`
      SELECT
        ma.id,
        ma.meetingId,
        ma.userId,
        u.firstName,
        u.lastName,
        a.name AS areaName,
        ma.status,
        ma.respondedAt
      FROM dbo.MeetingAttendees ma
      INNER JOIN dbo.Users u ON ma.userId = u.id
      INNER JOIN dbo.Areas a ON u.areaId = a.id
      WHERE ma.meetingId = @meetingId AND ma.userId = @userId
    `);
  return result.recordset[0] ?? null;
}

export async function updateMeetingAttendeeStatus(
  meetingId: number,
  userId: number,
  status: MeetingAttendeeStatus,
): Promise<void> {
  const pool = getPool();
  await pool
    .request()
    .input('meetingId', sql.Int, meetingId)
    .input('userId', sql.Int, userId)
    .input('status', sql.NVarChar(20), status).query(`
      UPDATE dbo.MeetingAttendees
      SET status = @status, respondedAt = SYSUTCDATETIME()
      WHERE meetingId = @meetingId AND userId = @userId
    `);
}

export async function deleteMeetingAttendees(meetingId: number): Promise<void> {
  const pool = getPool();
  await pool.request().input('meetingId', sql.Int, meetingId).query(`
    DELETE FROM dbo.MeetingAttendees WHERE meetingId = @meetingId
  `);
}

export async function insertMeetingExternalAttendee(input: {
  meetingId: number;
  name: string;
  email: string | null;
  company: string | null;
}): Promise<number> {
  const pool = getPool();
  const result = await pool
    .request()
    .input('meetingId', sql.Int, input.meetingId)
    .input('name', sql.NVarChar(200), input.name)
    .input('email', sql.NVarChar(255), input.email)
    .input('company', sql.NVarChar(200), input.company).query<{ id: number }>(`
      INSERT INTO dbo.MeetingExternalAttendees (meetingId, name, email, company)
      OUTPUT INSERTED.id
      VALUES (@meetingId, @name, @email, @company)
    `);
  return result.recordset[0]!.id;
}

export async function setMeetingExternalAttendees(
  meetingId: number,
  attendees: { name: string; email: string | null; company: string | null }[],
): Promise<void> {
  const pool = getPool();
  await pool.request().input('meetingId', sql.Int, meetingId).query(`
    DELETE FROM dbo.MeetingExternalAttendees WHERE meetingId = @meetingId
  `);

  for (const attendee of attendees) {
    await insertMeetingExternalAttendee({ meetingId, ...attendee });
  }
}

export async function listMeetingExternalAttendees(
  meetingId: number,
): Promise<MeetingExternalAttendeeRow[]> {
  const pool = getPool();
  const result = await pool.request().input('meetingId', sql.Int, meetingId)
    .query<MeetingExternalAttendeeRow>(`
      SELECT id, meetingId, name, email, company
      FROM dbo.MeetingExternalAttendees
      WHERE meetingId = @meetingId
      ORDER BY name
    `);
  return result.recordset;
}

export async function deleteMeetingExternalAttendees(meetingId: number): Promise<void> {
  const pool = getPool();
  await pool.request().input('meetingId', sql.Int, meetingId).query(`
    DELETE FROM dbo.MeetingExternalAttendees WHERE meetingId = @meetingId
  `);
}

export async function listMeetingReminderLog(meetingId: number): Promise<MeetingReminderLogRow[]> {
  const pool = getPool();
  const result = await pool.request().input('meetingId', sql.Int, meetingId)
    .query<MeetingReminderLogRow>(`
      SELECT id, meetingId, userId, externalEmail, reminderType, sentAt
      FROM dbo.MeetingReminderLog
      WHERE meetingId = @meetingId
      ORDER BY sentAt DESC
    `);
  return result.recordset;
}

export async function hasReminderLog(
  meetingId: number,
  reminderType: MeetingReminderType,
): Promise<boolean> {
  const pool = getPool();
  const result = await pool
    .request()
    .input('meetingId', sql.Int, meetingId)
    .input('reminderType', sql.NVarChar(20), reminderType).query<{ found: number }>(`
      SELECT TOP 1 1 AS found
      FROM dbo.MeetingReminderLog
      WHERE meetingId = @meetingId AND reminderType = @reminderType
    `);
  return (result.recordset[0]?.found ?? 0) > 0;
}

export async function insertReminderLog(input: {
  meetingId: number;
  userId?: number | null;
  externalEmail?: string | null;
  reminderType: MeetingReminderType;
}): Promise<number> {
  const pool = getPool();
  const result = await pool
    .request()
    .input('meetingId', sql.Int, input.meetingId)
    .input('userId', sql.Int, input.userId ?? null)
    .input('externalEmail', sql.NVarChar(255), input.externalEmail ?? null)
    .input('reminderType', sql.NVarChar(20), input.reminderType).query<{ id: number }>(`
      INSERT INTO dbo.MeetingReminderLog (meetingId, userId, externalEmail, reminderType)
      OUTPUT INSERTED.id
      VALUES (@meetingId, @userId, @externalEmail, @reminderType)
    `);
  return result.recordset[0]!.id;
}

export async function findMeetingsForReminder24h(): Promise<MeetingRow[]> {
  const pool = getPool();
  const result = await pool.request().query<MeetingRow>(`
    SELECT ${MEETING_SELECT}
    ${MEETING_FROM}
    WHERE m.status = N'SCHEDULED'
      AND m.startDateTime >= DATEADD(hour, 23, SYSUTCDATETIME())
      AND m.startDateTime <= DATEADD(hour, 25, SYSUTCDATETIME())
  `);
  return result.recordset.map(mapMeetingRow);
}

export async function findMeetingsForReminder1h(): Promise<MeetingRow[]> {
  const pool = getPool();
  const result = await pool.request().query<MeetingRow>(`
    SELECT ${MEETING_SELECT}
    ${MEETING_FROM}
    WHERE m.status = N'SCHEDULED'
      AND m.startDateTime >= DATEADD(minute, 45, SYSUTCDATETIME())
      AND m.startDateTime <= DATEADD(minute, 75, SYSUTCDATETIME())
  `);
  return result.recordset.map(mapMeetingRow);
}

export async function findMeetingsToAutoComplete(): Promise<MeetingRow[]> {
  const pool = getPool();
  const result = await pool.request().query<MeetingRow>(`
    SELECT ${MEETING_SELECT}
    ${MEETING_FROM}
    WHERE m.status = N'SCHEDULED'
      AND m.endDateTime < SYSUTCDATETIME()
  `);
  return result.recordset.map(mapMeetingRow);
}

export async function bulkCompleteMeetings(meetingIds: number[]): Promise<number> {
  if (meetingIds.length === 0) return 0;
  const pool = getPool();
  const request = pool.request();
  const placeholders = meetingIds.map((id, i) => {
    request.input(`id${i}`, sql.Int, id);
    return `@id${i}`;
  });
  const result = await request.query(`
    UPDATE dbo.Meetings
    SET status = N'COMPLETED', updatedAt = SYSUTCDATETIME()
    WHERE id IN (${placeholders.join(', ')}) AND status = N'SCHEDULED'
  `);
  return result.rowsAffected[0] ?? 0;
}

export async function isUserMeetingParticipant(
  meetingId: number,
  userId: number,
): Promise<boolean> {
  const pool = getPool();
  const result = await pool
    .request()
    .input('meetingId', sql.Int, meetingId)
    .input('userId', sql.Int, userId).query<{ found: number }>(`
      SELECT TOP 1 1 AS found
      FROM dbo.Meetings m
      WHERE m.id = @meetingId
        AND (
          m.organizerId = @userId
          OR EXISTS (
            SELECT 1 FROM dbo.MeetingAttendees ma
            WHERE ma.meetingId = m.id AND ma.userId = @userId
          )
        )
    `);
  return (result.recordset[0]?.found ?? 0) > 0;
}
