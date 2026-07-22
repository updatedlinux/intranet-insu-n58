export type AnnouncementCategory = 'NOTICIA' | 'CIRCULAR' | 'EVENTO' | 'URGENTE';
export type AnnouncementStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

export const ANNOUNCEMENT_CATEGORY_LABELS: Record<AnnouncementCategory, string> = {
  NOTICIA: 'Noticia',
  CIRCULAR: 'Circular',
  EVENTO: 'Evento',
  URGENTE: 'Urgente',
};

export const ANNOUNCEMENT_STATUS_LABELS: Record<AnnouncementStatus, string> = {
  DRAFT: 'Borrador',
  PUBLISHED: 'Publicado',
  ARCHIVED: 'Archivado',
};

export interface Announcement {
  id: number;
  title: string;
  content: string;
  summary: string;
  imageUrl: string | null;
  imageKey: string | null;
  category: AnnouncementCategory;
  categoryLabel: string;
  targetAreaId: number | null;
  targetAreaName: string | null;
  audienceLabel: string;
  status: AnnouncementStatus;
  statusLabel: string;
  authorName: string;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AnnouncementFormData {
  title: string;
  content: string;
  summary: string;
  imageUrl: string | null;
  category: AnnouncementCategory;
  targetAreaId: number | null;
  publish?: boolean;
}

export interface AnnouncementFilters {
  search?: string;
  category?: AnnouncementCategory;
  status?: AnnouncementStatus;
}
