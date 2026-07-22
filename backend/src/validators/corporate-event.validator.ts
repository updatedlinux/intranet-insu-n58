import type { CorporateEventStatus } from '../constants/corporate-event-status';
import type { CorporateEventListTab } from '../repositories/corporate-event.repository';

function parseIdArray(value: unknown, field: string): number[] {
  if (!Array.isArray(value)) return [];
  const ids = value
    .map((v) => Number.parseInt(String(v), 10))
    .filter((id) => Number.isInteger(id) && id > 0);
  if (value.length > 0 && ids.length !== value.length) {
    throw new Error(`${field} contiene identificadores inválidos`);
  }
  return ids;
}

export function parseEventListQuery(query: Record<string, unknown>): {
  tab: CorporateEventListTab;
} {
  const tab = query.tab === 'past' ? 'past' : 'upcoming';
  return { tab };
}

export function parseEventManageQuery(query: Record<string, unknown>): {
  status?: CorporateEventStatus;
  search?: string;
} {
  const status = query.status;
  const validStatuses = ['DRAFT', 'PUBLISHED', 'CANCELLED'];
  return {
    status:
      typeof status === 'string' && validStatuses.includes(status)
        ? (status as CorporateEventStatus)
        : undefined,
    search: typeof query.search === 'string' ? query.search : undefined,
  };
}

export function validateEventBody(body: Record<string, unknown>): {
  title: string;
  description: string | null;
  location: string | null;
  startDateTime: Date;
  endDateTime: Date;
  isCompanyWide: boolean;
  areaIds: number[];
} {
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const description =
    typeof body.description === 'string' && body.description.trim()
      ? body.description.trim()
      : null;
  const location =
    typeof body.location === 'string' && body.location.trim() ? body.location.trim() : null;
  const startRaw = body.startDateTime;
  const endRaw = body.endDateTime;
  const startDateTime = startRaw ? new Date(String(startRaw)) : new Date(NaN);
  const endDateTime = endRaw ? new Date(String(endRaw)) : new Date(NaN);

  if (Number.isNaN(startDateTime.getTime()) || Number.isNaN(endDateTime.getTime())) {
    throw new Error('Fechas de inicio y fin inválidas');
  }

  const isCompanyWide =
    body.isCompanyWide === true || body.isCompanyWide === 'true' || body.isCompanyWide === 1;
  const areaIds = parseIdArray(body.areaIds, 'areaIds');

  return {
    title,
    description,
    location,
    startDateTime,
    endDateTime,
    isCompanyWide,
    areaIds,
  };
}
