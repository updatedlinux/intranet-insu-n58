import type { AnnouncementCategory } from '../constants/announcement-category';
import { ANNOUNCEMENT_STATUS, type AnnouncementStatus } from '../constants/announcement-status';
import type { AppError } from '../middlewares/error.middleware';
import {
  assertCanManageAnnouncements,
  assertTargetAreaAllowed,
  canEditAnnouncement,
  canManageAnnouncements,
  canPublishCompanyWide,
  canViewAnnouncement,
  getPublishableTargetAreaIds,
} from '../policies/announcement-access.policy';
import { isSystemAdmin } from '../policies/document-access.policy';
import { NOTIFICATION_RESOURCE_TYPES, NOTIFICATION_TYPES } from '../constants/notification-type';
import {
  createAnnouncement,
  findAnnouncementById,
  listAnnouncementRecipientEmails,
  listAnnouncementRecipientUserIds,
  listAnnouncements,
  setAnnouncementStatus,
  updateAnnouncement,
  type AnnouncementRow,
} from '../repositories/announcement.repository';
import { findAreaById } from '../repositories/area.repository';
import {
  resolveAnnouncementImageUrl,
  uploadAnnouncementImage,
} from './announcement-storage.service';
import { displayName, emailService } from './email.service';
import { createNotificationsForUsers } from './notification.service';
import type { AuthenticatedUser } from '../types/auth';
import { ANNOUNCEMENT_CATEGORY_LABELS } from '../constants/announcement-category';
import { ANNOUNCEMENT_STATUS_LABELS } from '../constants/announcement-status';

export interface PublicAnnouncement {
  id: number;
  title: string;
  content: string;
  summary: string;
  /** URL firmada para mostrar en UI */
  imageUrl: string | null;
  /** Clave en MinIO (para formularios de edición) */
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

export interface AnnouncementCapabilities {
  canManage: boolean;
  canPublishCompanyWide: boolean;
  publishableAreaIds: number[];
}

function notFound(message = 'Comunicado no encontrado'): AppError {
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

function audienceLabel(targetAreaName: string | null): string {
  return targetAreaName ?? 'Toda la empresa';
}

async function toPublic(row: AnnouncementRow): Promise<PublicAnnouncement> {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    summary: row.summary,
    imageUrl: await resolveAnnouncementImageUrl(row.imageUrl),
    imageKey: row.imageUrl,
    category: row.category,
    categoryLabel: ANNOUNCEMENT_CATEGORY_LABELS[row.category],
    targetAreaId: row.targetAreaId,
    targetAreaName: row.targetAreaName,
    audienceLabel: audienceLabel(row.targetAreaName),
    status: row.status,
    statusLabel: ANNOUNCEMENT_STATUS_LABELS[row.status],
    authorName: displayName(row.authorFirstName, row.authorLastName),
    publishedAt: row.publishedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function assertTargetAreaExists(targetAreaId: number | null): Promise<void> {
  if (targetAreaId == null) return;
  const area = await findAreaById(targetAreaId);
  if (!area?.isActive) throw badRequest('Área destino no válida');
}

export async function getAnnouncementCapabilitiesService(
  user: AuthenticatedUser,
): Promise<AnnouncementCapabilities> {
  const publishableAreaIds = isSystemAdmin(user) ? [] : await getPublishableTargetAreaIds(user);
  return {
    canManage: canManageAnnouncements(user),
    canPublishCompanyWide: canPublishCompanyWide(user),
    publishableAreaIds,
  };
}

async function publishedListFilters(user: AuthenticatedUser): Promise<{
  userAreaId?: number;
}> {
  if (isSystemAdmin(user)) return {};
  return { userAreaId: user.area.id };
}

export async function listPublishedAnnouncementsService(
  user: AuthenticatedUser,
  filters: { search?: string; category?: AnnouncementCategory },
): Promise<{ items: PublicAnnouncement[] }> {
  const rows = await listAnnouncements({
    ...(await publishedListFilters(user)),
    search: filters.search,
    category: filters.category,
  });
  return { items: await Promise.all(rows.map(toPublic)) };
}

export async function listLatestAnnouncementsService(
  user: AuthenticatedUser,
  limit = 3,
): Promise<{ items: PublicAnnouncement[] }> {
  const rows = await listAnnouncements({
    ...(await publishedListFilters(user)),
    limit,
  });
  return { items: await Promise.all(rows.map(toPublic)) };
}

export async function listManageAnnouncementsService(
  user: AuthenticatedUser,
  filters: {
    search?: string;
    status?: AnnouncementStatus;
    category?: AnnouncementCategory;
  },
): Promise<{ items: PublicAnnouncement[] }> {
  assertCanManageAnnouncements(user);

  const rows = await listAnnouncements({
    includeAllStatuses: true,
    status: filters.status,
    category: filters.category,
    search: filters.search,
  });

  const visible: AnnouncementRow[] = [];
  for (const row of rows) {
    if (await canEditAnnouncement(user, row)) visible.push(row);
  }

  return { items: await Promise.all(visible.map(toPublic)) };
}

export async function getAnnouncementService(
  user: AuthenticatedUser,
  id: number,
): Promise<PublicAnnouncement> {
  const row = await findAnnouncementById(id);
  if (!row) throw notFound();
  if (!(await canViewAnnouncement(user, row))) {
    throw forbidden('No tiene permisos para ver este comunicado');
  }
  return toPublic(row);
}

export async function uploadAnnouncementImageService(
  user: AuthenticatedUser,
  file: { buffer: Buffer; mimetype: string; originalname: string },
): Promise<{ imageKey: string }> {
  assertCanManageAnnouncements(user);
  try {
    const imageKey = await uploadAnnouncementImage(file.buffer, file.mimetype, file.originalname);
    return { imageKey };
  } catch (error) {
    throw badRequest(error instanceof Error ? error.message : 'No se pudo subir la imagen');
  }
}

export async function createAnnouncementService(
  user: AuthenticatedUser,
  data: {
    title: string;
    content: string;
    summary: string;
    imageUrl: string | null;
    category: AnnouncementCategory;
    targetAreaId: number | null;
    publish?: boolean;
  },
): Promise<PublicAnnouncement> {
  assertCanManageAnnouncements(user);
  await assertTargetAreaAllowed(user, data.targetAreaId);
  await assertTargetAreaExists(data.targetAreaId);

  const status = data.publish ? ANNOUNCEMENT_STATUS.PUBLISHED : ANNOUNCEMENT_STATUS.DRAFT;
  const publishedAt = data.publish ? new Date() : null;

  const id = await createAnnouncement({
    ...data,
    status,
    createdBy: user.id,
    publishedAt,
  });

  const row = await findAnnouncementById(id);
  if (!row) throw notFound();

  if (data.publish) {
    notifyAnnouncementPublished(row);
  }

  return toPublic(row);
}

export async function updateAnnouncementService(
  user: AuthenticatedUser,
  id: number,
  data: {
    title: string;
    content: string;
    summary: string;
    imageUrl: string | null;
    category: AnnouncementCategory;
    targetAreaId: number | null;
  },
): Promise<PublicAnnouncement> {
  const existing = await findAnnouncementById(id);
  if (!existing) throw notFound();
  if (!(await canEditAnnouncement(user, existing))) {
    throw forbidden('No puede editar este comunicado');
  }
  if (existing.status === ANNOUNCEMENT_STATUS.ARCHIVED) {
    throw badRequest('No se puede editar un comunicado archivado');
  }

  await assertTargetAreaAllowed(user, data.targetAreaId);
  await assertTargetAreaExists(data.targetAreaId);

  await updateAnnouncement(id, {
    ...data,
    status: existing.status,
    publishedAt: existing.publishedAt,
  });

  const row = await findAnnouncementById(id);
  if (!row) throw notFound();
  return toPublic(row);
}

export async function publishAnnouncementService(
  user: AuthenticatedUser,
  id: number,
): Promise<PublicAnnouncement> {
  const existing = await findAnnouncementById(id);
  if (!existing) throw notFound();
  if (!(await canEditAnnouncement(user, existing))) {
    throw forbidden('No puede publicar este comunicado');
  }
  if (existing.status === ANNOUNCEMENT_STATUS.PUBLISHED) {
    throw badRequest('El comunicado ya está publicado');
  }
  if (existing.status === ANNOUNCEMENT_STATUS.ARCHIVED) {
    throw badRequest('No se puede publicar un comunicado archivado');
  }

  const publishedAt = new Date();
  await setAnnouncementStatus(id, ANNOUNCEMENT_STATUS.PUBLISHED, publishedAt);

  const row = await findAnnouncementById(id);
  if (!row) throw notFound();

  notifyAnnouncementPublished(row);

  return toPublic(row);
}

export async function archiveAnnouncementService(
  user: AuthenticatedUser,
  id: number,
): Promise<PublicAnnouncement> {
  const existing = await findAnnouncementById(id);
  if (!existing) throw notFound();
  if (!(await canEditAnnouncement(user, existing))) {
    throw forbidden('No puede archivar este comunicado');
  }

  await setAnnouncementStatus(id, ANNOUNCEMENT_STATUS.ARCHIVED, existing.publishedAt);

  const row = await findAnnouncementById(id);
  if (!row) throw notFound();
  return toPublic(row);
}

function notifyAnnouncementPublished(row: AnnouncementRow): void {
  const categoryLabel = ANNOUNCEMENT_CATEGORY_LABELS[row.category];
  const audience = row.targetAreaName ?? 'toda la empresa';

  void (async () => {
    try {
      const userIds = await listAnnouncementRecipientUserIds(row.targetAreaId);
      if (userIds.length > 0) {
        await createNotificationsForUsers(
          userIds,
          NOTIFICATION_TYPES.ANNOUNCEMENT,
          'Nuevo comunicado publicado',
          `${categoryLabel}: ${row.title} (${audience})`,
          NOTIFICATION_RESOURCE_TYPES.ANNOUNCEMENT,
          row.id,
        );
      }
    } catch (error) {
      console.error(
        `[notifications] Error al notificar comunicado id=${row.id}:`,
        error instanceof Error ? error.message : error,
      );
    }
  })();

  void (async () => {
    try {
      const recipients = await listAnnouncementRecipientEmails(row.targetAreaId);
      if (recipients.length === 0) {
        console.warn(`[email] Sin destinatarios para comunicado id=${row.id}`);
        return;
      }

      let sentCount = 0;
      for (const recipient of recipients) {
        try {
          const ok = await emailService.sendAnnouncementNotification(
            recipient.email,
            displayName(recipient.firstName, recipient.lastName),
            row.title,
            row.summary,
            categoryLabel,
            row.id,
          );
          if (ok) sentCount += 1;
        } catch (error) {
          console.error(
            `[email] Error al notificar comunicado id=${row.id} a ${recipient.email}:`,
            error instanceof Error ? error.message : error,
          );
        }
      }
      console.log(
        `[email] Notificaciones comunicado id=${row.id}: ${sentCount}/${recipients.length} enviadas`,
      );
    } catch (error) {
      console.error(
        `[email] Error en envío masivo comunicado id=${row.id}:`,
        error instanceof Error ? error.message : error,
      );
    }
  })();
}

export { canManageAnnouncements };
