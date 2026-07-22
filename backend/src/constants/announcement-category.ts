export const ANNOUNCEMENT_CATEGORY = {
  NOTICIA: 'NOTICIA',
  CIRCULAR: 'CIRCULAR',
  EVENTO: 'EVENTO',
  URGENTE: 'URGENTE',
} as const;

export type AnnouncementCategory =
  (typeof ANNOUNCEMENT_CATEGORY)[keyof typeof ANNOUNCEMENT_CATEGORY];

export const ANNOUNCEMENT_CATEGORY_LABELS: Record<AnnouncementCategory, string> = {
  NOTICIA: 'Noticia',
  CIRCULAR: 'Circular',
  EVENTO: 'Evento',
  URGENTE: 'Urgente',
};
