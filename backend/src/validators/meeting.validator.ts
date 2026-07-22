import type { AppError } from '../middlewares/error.middleware';
import {
  MEETING_ATTENDEE_STATUSES,
  type MeetingAttendeeStatus,
} from '../constants/meeting-attendee-status';
import { MEETING_STATUSES, type MeetingStatus } from '../constants/meeting-status';

function badRequest(message: string): AppError {
  const error = new Error(message) as AppError;
  error.statusCode = 400;
  return error;
}

function requireString(value: unknown, field: string, maxLen: number): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw badRequest(`${field} es obligatorio`);
  }
  const trimmed = value.trim();
  if (trimmed.length > maxLen) throw badRequest(`${field} demasiado largo`);
  return trimmed;
}

function parsePositiveInt(value: unknown, field: string): number {
  const num = typeof value === 'string' ? Number.parseInt(value, 10) : value;
  if (typeof num !== 'number' || !Number.isInteger(num) || num <= 0) {
    throw badRequest(`${field} inválido`);
  }
  return num;
}

function parseOptionalString(value: unknown, maxLen: number): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') throw badRequest('Texto inválido');
  const trimmed = value.trim();
  if (trimmed.length > maxLen) throw badRequest('Texto demasiado largo');
  return trimmed || null;
}

function parseDateTime(value: unknown, field: string): Date {
  if (typeof value !== 'string' || !value.trim()) {
    throw badRequest(`${field} es obligatorio`);
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw badRequest(`${field} inválido`);
  return date;
}

function parseOptionalDateTime(value: unknown, field: string): Date | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  return parseDateTime(value, field);
}

function parseBoolean(value: unknown, field: string): boolean {
  if (typeof value === 'boolean') return value;
  if (value === 'true' || value === 1 || value === '1') return true;
  if (value === 'false' || value === 0 || value === '0') return false;
  throw badRequest(`${field} inválido`);
}

function parseOptionalBoolean(value: unknown): boolean | undefined {
  if (value === undefined || value === null) return undefined;
  return parseBoolean(value, 'isRemote');
}

function parseIdArray(value: unknown, field: string): number[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw badRequest(`${field} debe ser un arreglo`);
  return [...new Set(value.map((item, i) => parsePositiveInt(item, `${field}[${i}]`)))];
}

function parseExternalAttendees(
  value: unknown,
): { name: string; email: string | null; company: string | null }[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw badRequest('externalAttendees debe ser un arreglo');

  return value.map((item, index) => {
    if (typeof item !== 'object' || item === null) {
      throw badRequest(`externalAttendees[${index}] inválido`);
    }
    const row = item as Record<string, unknown>;
    return {
      name: requireString(row.name, `externalAttendees[${index}].name`, 200),
      email: parseOptionalString(row.email, 255),
      company: parseOptionalString(row.company, 200),
    };
  });
}

function parseMeetingStatus(value: unknown): MeetingStatus | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string' || !MEETING_STATUSES.includes(value as MeetingStatus)) {
    throw badRequest('Estado inválido');
  }
  return value as MeetingStatus;
}

function parseAttendeeResponseStatus(value: unknown): MeetingAttendeeStatus {
  if (
    typeof value !== 'string' ||
    !MEETING_ATTENDEE_STATUSES.includes(value as MeetingAttendeeStatus)
  ) {
    throw badRequest('Estado de respuesta inválido');
  }
  if (value === 'PENDING') throw badRequest('Estado de respuesta inválido');
  return value as MeetingAttendeeStatus;
}

export function validateCreateMeetingBody(body: Record<string, unknown>) {
  const isRemote = parseBoolean(body.isRemote, 'isRemote');
  return {
    title: requireString(body.title, 'Título', 300),
    description: parseOptionalString(body.description, 50_000),
    startDateTime: parseDateTime(body.startDateTime, 'startDateTime'),
    endDateTime: parseDateTime(body.endDateTime, 'endDateTime'),
    isRemote,
    meetingLink: isRemote ? requireString(body.meetingLink, 'meetingLink', 500) : null,
    location: isRemote ? null : requireString(body.location, 'location', 300),
    attendeeIds: parseIdArray(body.attendeeIds, 'attendeeIds'),
    externalAttendees: parseExternalAttendees(body.externalAttendees),
  };
}

export function validateUpdateMeetingBody(body: Record<string, unknown>) {
  const isRemote = parseOptionalBoolean(body.isRemote);
  const result: {
    title?: string;
    description?: string | null;
    startDateTime?: Date;
    endDateTime?: Date;
    isRemote?: boolean;
    meetingLink?: string | null;
    location?: string | null;
    attendeeIds?: number[];
    externalAttendees?: { name: string; email: string | null; company: string | null }[];
  } = {};

  if (body.title !== undefined) result.title = requireString(body.title, 'Título', 300);
  if (body.description !== undefined)
    result.description = parseOptionalString(body.description, 50_000);
  if (body.startDateTime !== undefined)
    result.startDateTime = parseDateTime(body.startDateTime, 'startDateTime');
  if (body.endDateTime !== undefined)
    result.endDateTime = parseDateTime(body.endDateTime, 'endDateTime');
  if (isRemote !== undefined) result.isRemote = isRemote;
  if (body.meetingLink !== undefined) {
    result.meetingLink = parseOptionalString(body.meetingLink, 500);
  }
  if (body.location !== undefined) {
    result.location = parseOptionalString(body.location, 300);
  }
  if (body.attendeeIds !== undefined) {
    result.attendeeIds = parseIdArray(body.attendeeIds, 'attendeeIds');
  }
  if (body.externalAttendees !== undefined) {
    result.externalAttendees = parseExternalAttendees(body.externalAttendees);
  }

  return result;
}

export function validateCancelMeetingBody(body: Record<string, unknown>) {
  return {
    cancellationReason: requireString(body.cancellationReason, 'cancellationReason', 500),
  };
}

export function validateRespondMeetingBody(body: Record<string, unknown>) {
  return {
    status: parseAttendeeResponseStatus(body.status),
  };
}

export function parseMeetingListQuery(query: Record<string, unknown>) {
  const tabRaw = query.tab;
  let tab: 'upcoming' | 'past' | undefined;
  if (tabRaw !== undefined && tabRaw !== null && tabRaw !== '') {
    if (tabRaw !== 'upcoming' && tabRaw !== 'past') {
      throw badRequest('tab inválido');
    }
    tab = tabRaw;
  }

  return {
    tab,
    status: parseMeetingStatus(query.status),
    fromDate: parseOptionalDateTime(query.from, 'from'),
    toDate: parseOptionalDateTime(query.to, 'to'),
  };
}
