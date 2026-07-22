export const CORPORATE_EVENT_STATUS = {
  DRAFT: 'DRAFT',
  PUBLISHED: 'PUBLISHED',
  CANCELLED: 'CANCELLED',
} as const;

export type CorporateEventStatus =
  (typeof CORPORATE_EVENT_STATUS)[keyof typeof CORPORATE_EVENT_STATUS];

export const CORPORATE_EVENT_STATUS_LABELS: Record<CorporateEventStatus, string> = {
  DRAFT: 'Borrador',
  PUBLISHED: 'Publicado',
  CANCELLED: 'Cancelado',
};
