import type { AppError } from '../middlewares/error.middleware';
import { CORPORATE_EVENT_STATUS_LABELS } from '../constants/corporate-event-status';
import type { CorporateEventStatus } from '../constants/corporate-event-status';
import {
  findCorporateEventById,
  insertCorporateEvent,
  listCorporateEventAreaIds,
  listCorporateEventsForUser,
  listCorporateEventsManage,
  listUpcomingCorporateEventsForUser,
  setCorporateEventStatus,
  updateCorporateEvent,
  userCanViewCorporateEvent,
  type CorporateEventListTab,
  type CorporateEventRow,
} from '../repositories/corporate-event.repository';

export interface PublicCorporateEvent {
  id: number;
  title: string;
  description: string | null;
  location: string | null;
  startDateTime: string;
  endDateTime: string;
  isCompanyWide: boolean;
  audienceLabel: string;
  status: CorporateEventStatus;
  statusLabel: string;
  areaIds: number[];
  areaNames: string[];
  createdBy: number;
  creatorName: string;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

function badRequest(message: string): AppError {
  const error = new Error(message) as AppError;
  error.statusCode = 400;
  return error;
}

function notFound(message = 'Evento no encontrado'): AppError {
  const error = new Error(message) as AppError;
  error.statusCode = 404;
  return error;
}

function toPublic(row: CorporateEventRow): PublicCorporateEvent {
  const areaIds = row.areaIds
    ? row.areaIds
        .split(',')
        .map((id) => Number.parseInt(id, 10))
        .filter((id) => id > 0)
    : [];
  const areaNames = row.areaNames ? row.areaNames.split(', ') : [];

  return {
    id: row.id,
    title: row.title,
    description: row.description,
    location: row.location,
    startDateTime: row.startDateTime.toISOString(),
    endDateTime: row.endDateTime.toISOString(),
    isCompanyWide: row.isCompanyWide,
    audienceLabel: row.isCompanyWide ? 'Toda la empresa' : areaNames.join(', ') || 'Sin áreas',
    status: row.status,
    statusLabel: CORPORATE_EVENT_STATUS_LABELS[row.status],
    areaIds,
    areaNames,
    createdBy: row.createdBy,
    creatorName: `${row.creatorFirstName} ${row.creatorLastName}`.trim(),
    publishedAt: row.publishedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function validateEventPayload(data: {
  title: string;
  startDateTime: Date;
  endDateTime: Date;
  isCompanyWide: boolean;
  areaIds: number[];
}): void {
  if (!data.title.trim()) throw badRequest('El título es obligatorio');
  if (data.endDateTime < data.startDateTime) {
    throw badRequest('La fecha de fin debe ser posterior al inicio');
  }
  if (!data.isCompanyWide && data.areaIds.length === 0) {
    throw badRequest('Seleccione al menos un área o marque el evento para toda la empresa');
  }
}

export async function listEventsForUserService(
  userAreaId: number,
  tab: CorporateEventListTab,
): Promise<PublicCorporateEvent[]> {
  const rows = await listCorporateEventsForUser(userAreaId, tab);
  return rows.map(toPublic);
}

export async function listUpcomingEventsForDashboardService(
  userAreaId: number,
  limit = 5,
): Promise<PublicCorporateEvent[]> {
  const rows = await listUpcomingCorporateEventsForUser(userAreaId, limit);
  return rows.map(toPublic);
}

export async function getEventForUserService(
  eventId: number,
  userAreaId: number,
): Promise<PublicCorporateEvent> {
  const allowed = await userCanViewCorporateEvent(eventId, userAreaId);
  if (!allowed) throw notFound();
  const row = await findCorporateEventById(eventId);
  if (!row) throw notFound();
  return toPublic(row);
}

export async function listEventsManageService(filters: {
  status?: CorporateEventStatus;
  search?: string;
}): Promise<PublicCorporateEvent[]> {
  const rows = await listCorporateEventsManage(filters);
  return rows.map(toPublic);
}

export async function getEventManageService(id: number): Promise<PublicCorporateEvent> {
  const row = await findCorporateEventById(id);
  if (!row) throw notFound();
  return toPublic(row);
}

export async function createEventService(
  userId: number,
  data: {
    title: string;
    description: string | null;
    location: string | null;
    startDateTime: Date;
    endDateTime: Date;
    isCompanyWide: boolean;
    areaIds: number[];
  },
): Promise<PublicCorporateEvent> {
  validateEventPayload(data);
  const id = await insertCorporateEvent({ ...data, createdBy: userId });
  return getEventManageService(id);
}

export async function updateEventService(
  id: number,
  data: {
    title: string;
    description: string | null;
    location: string | null;
    startDateTime: Date;
    endDateTime: Date;
    isCompanyWide: boolean;
    areaIds: number[];
  },
): Promise<PublicCorporateEvent> {
  const existing = await findCorporateEventById(id);
  if (!existing) throw notFound();
  if (existing.status === 'CANCELLED') {
    throw badRequest('No se puede editar un evento cancelado');
  }
  validateEventPayload(data);
  await updateCorporateEvent(id, data);
  return getEventManageService(id);
}

export async function publishEventService(id: number): Promise<PublicCorporateEvent> {
  const existing = await findCorporateEventById(id);
  if (!existing) throw notFound();
  if (existing.status === 'CANCELLED') throw badRequest('El evento está cancelado');
  if (existing.status === 'PUBLISHED') return toPublic(existing);

  if (!existing.isCompanyWide) {
    const areaIds = await listCorporateEventAreaIds(id);
    if (areaIds.length === 0) throw badRequest('Debe asignar al menos un área');
  }

  await setCorporateEventStatus(id, 'PUBLISHED', new Date());
  return getEventManageService(id);
}

export async function cancelEventService(id: number): Promise<PublicCorporateEvent> {
  const existing = await findCorporateEventById(id);
  if (!existing) throw notFound();
  await setCorporateEventStatus(id, 'CANCELLED', null);
  return getEventManageService(id);
}
