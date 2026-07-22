import type { Readable } from 'node:stream';
import { buffer as streamToBuffer } from 'node:stream/consumers';
import { NOTIFICATION_RESOURCE_TYPES, NOTIFICATION_TYPES } from '../constants/notification-type';
import { TICKET_PRIORITY_LABELS, type TicketPriority } from '../constants/ticket-priority';
import { TICKET_STATUS, TICKET_STATUS_LABELS, type TicketStatus } from '../constants/ticket-status';
import type { AppError } from '../middlewares/error.middleware';
import { findActiveTicketCategoryById } from '../repositories/ticket-category.repository';
import {
  canAssignTicket,
  canCloseTicket,
  canCommentOnTicket,
  canItChangeStatus,
  canManageTicket,
  canUpdateTicketFields,
  canViewTicket,
  isItAgent,
  isItAgentUserId,
} from '../policies/ticket.policy';
import {
  allocateTicketCode,
  countTicketsByCategory,
  createTicket,
  deleteTicket,
  findTicketById,
  getTicketMetrics,
  insertTicketComment,
  listItTeamUserIds,
  listTicketComments,
  listTickets,
  touchTicketUpdated,
  updateTicketAssignment,
  updateTicketPriority,
  updateTicketStatus,
  type TicketCommentRow,
  type TicketRow,
} from '../repositories/ticket.repository';
import {
  findTicketAttachmentById,
  insertTicketAttachment,
  listTicketAttachmentsByTicketId,
} from '../repositories/ticket-attachment.repository';
import { findUserById } from '../repositories/user.repository';
import type { AuthenticatedUser } from '../types/auth';
import { displayName, emailService, notifyEmail } from './email.service';
import { createNotification, createNotificationsForUsers } from './notification.service';
import {
  uploadTicketAttachmentObject,
  getTicketAttachmentObject,
} from './ticket-attachment-storage.service';
import {
  getCachedTicketAttachment,
  setCachedTicketAttachment,
} from './ticket-attachment-cache.service';
import type { TicketUploadFile } from '../utils/ticket-files';
import { validateTicketAttachments } from '../utils/ticket-files';

export interface PublicTicket {
  id: number;
  code: string;
  title: string;
  description: string;
  categoryId: number;
  categoryName: string;
  priority: TicketPriority;
  priorityLabel: string;
  status: TicketStatus;
  statusLabel: string;
  requesterId: number;
  requesterName: string;
  requesterAreaName: string;
  assignedTo: number | null;
  assigneeName: string | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  closedAt: string | null;
}

export interface PublicTicketAttachment {
  id: number;
  ticketId: number;
  fileName: string;
  fileSize: number;
  mimeType: string;
  createdAt: string;
}

export interface ServedTicketAttachment {
  fileName: string;
  mimeType: string;
  buffer?: Buffer;
  stream?: Readable;
}

export type TicketCommentAuthorRole = 'requester' | 'it_assignee' | 'it_agent';

export interface PublicTicketComment {
  id: number;
  ticketId: number;
  userId: number;
  authorName: string;
  authorAreaName: string;
  authorRole: TicketCommentAuthorRole;
  message: string;
  createdAt: string;
  isOwn: boolean;
}

export interface TicketCapabilities {
  isItAgent: boolean;
  canManageDesk: boolean;
}

export interface TicketMetrics {
  openCount: number;
  inProgressCount: number;
  avgResolutionHours: number | null;
  byCategory: { categoryId: number; categoryName: string; count: number }[];
}

function notFound(message = 'Ticket no encontrado'): AppError {
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

function toPublicTicket(row: TicketRow): PublicTicket {
  return {
    id: row.id,
    code: row.code,
    title: row.title,
    description: row.description,
    categoryId: row.categoryId,
    categoryName: row.categoryName,
    priority: row.priority,
    priorityLabel: TICKET_PRIORITY_LABELS[row.priority],
    status: row.status,
    statusLabel: TICKET_STATUS_LABELS[row.status],
    requesterId: row.requesterId,
    requesterName: displayName(row.requesterFirstName, row.requesterLastName),
    requesterAreaName: row.requesterAreaName,
    assignedTo: row.assignedTo,
    assigneeName:
      row.assignedTo != null
        ? displayName(row.assigneeFirstName ?? '', row.assigneeLastName ?? '')
        : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    resolvedAt: row.resolvedAt?.toISOString() ?? null,
    closedAt: row.closedAt?.toISOString() ?? null,
  };
}

function resolveCommentAuthorRole(
  row: TicketCommentRow,
  ticket: Pick<TicketRow, 'requesterId' | 'assignedTo'>,
): TicketCommentAuthorRole {
  if (row.userId === ticket.requesterId) return 'requester';
  if (row.authorAreaIsItSupport) {
    return row.userId === ticket.assignedTo ? 'it_assignee' : 'it_agent';
  }
  return 'requester';
}

function toPublicComment(
  row: TicketCommentRow,
  viewerId: number,
  ticket: Pick<TicketRow, 'requesterId' | 'assignedTo'>,
): PublicTicketComment {
  return {
    id: row.id,
    ticketId: row.ticketId,
    userId: row.userId,
    authorName: displayName(row.authorFirstName, row.authorLastName),
    authorAreaName: row.authorAreaName,
    authorRole: resolveCommentAuthorRole(row, ticket),
    message: row.message,
    createdAt: row.createdAt.toISOString(),
    isOwn: row.userId === viewerId,
  };
}

export function getTicketCapabilities(user: AuthenticatedUser): TicketCapabilities {
  const it = isItAgent(user);
  return { isItAgent: it, canManageDesk: canManageTicket(user) };
}

export async function createTicketService(
  user: AuthenticatedUser,
  data: {
    title: string;
    description: string;
    categoryId: number;
    priority: TicketPriority;
  },
  files: TicketUploadFile[] = [],
): Promise<PublicTicket> {
  const category = await findActiveTicketCategoryById(data.categoryId);
  if (!category) throw badRequest('Categoría no válida o inactiva');

  if (files.length > 0) {
    try {
      validateTicketAttachments(files);
    } catch (error) {
      throw badRequest(error instanceof Error ? error.message : 'Archivos adjuntos inválidos');
    }
  }

  const code = await allocateTicketCode();
  const id = await createTicket({
    code,
    requesterId: user.id,
    ...data,
  });

  try {
    for (const file of files) {
      const { fileKey } = await uploadTicketAttachmentObject(
        file.buffer,
        file.mimetype,
        file.originalname,
      );
      await insertTicketAttachment({
        ticketId: id,
        fileName: file.originalname,
        fileKey,
        fileSize: file.size,
        mimeType: file.mimetype,
      });
    }
  } catch (error) {
    await deleteTicket(id);
    console.error('[tickets] Error al guardar adjuntos, ticket revertido:', error);
    throw badRequest('No se pudieron guardar los archivos adjuntos');
  }

  const row = await findTicketById(id);
  if (!row) throw notFound();

  void notifyTicketCreated(row);

  return toPublicTicket(row);
}

export async function listTicketsService(
  user: AuthenticatedUser,
  filters: {
    status?: TicketStatus;
    priority?: TicketPriority;
    categoryId?: number;
    requesterId?: number;
    search?: string;
    activeOnly?: boolean;
    mineOnly?: boolean;
  },
): Promise<{ items: PublicTicket[] }> {
  const listFilters =
    filters.mineOnly || !canManageTicket(user) ? { ...filters, requesterId: user.id } : filters;

  const { mineOnly: _mine, ...repoFilters } = listFilters;
  const rows = await listTickets(repoFilters);
  return { items: rows.map(toPublicTicket) };
}

function toPublicAttachment(row: {
  id: number;
  ticketId: number;
  fileName: string;
  fileSize: number;
  mimeType: string;
  createdAt: Date;
}): PublicTicketAttachment {
  return {
    id: row.id,
    ticketId: row.ticketId,
    fileName: row.fileName,
    fileSize: Number(row.fileSize),
    mimeType: row.mimeType,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function getTicketService(
  user: AuthenticatedUser,
  id: number,
): Promise<{
  item: PublicTicket;
  comments: PublicTicketComment[];
  attachments: PublicTicketAttachment[];
}> {
  const row = await findTicketById(id);
  if (!row) throw notFound();
  if (!canViewTicket(user, row)) throw forbidden('No tiene permisos para ver este ticket');

  const [comments, attachments] = await Promise.all([
    listTicketComments(id),
    listTicketAttachmentsByTicketId(id),
  ]);
  return {
    item: toPublicTicket(row),
    comments: comments.map((c) => toPublicComment(c, user.id, row)),
    attachments: attachments.map(toPublicAttachment),
  };
}

export async function serveTicketAttachmentService(
  user: AuthenticatedUser,
  ticketId: number,
  attachmentId: number,
): Promise<ServedTicketAttachment> {
  const row = await findTicketById(ticketId);
  if (!row) throw notFound();
  if (!canViewTicket(user, row)) throw forbidden('No tiene permisos para ver este ticket');

  const attachment = await findTicketAttachmentById(attachmentId);
  if (!attachment || attachment.ticketId !== ticketId) throw notFound('Adjunto no encontrado');

  const cached = await getCachedTicketAttachment(attachmentId);
  if (cached) {
    return {
      fileName: cached.fileName,
      mimeType: cached.contentType,
      buffer: cached.buffer,
    };
  }

  const object = await getTicketAttachmentObject(attachment.fileKey);
  const knownSize = attachment.fileSize ?? object.contentLength ?? 0;

  if (knownSize > 0 && knownSize <= 1024 * 1024) {
    const buffer = await readableToBuffer(object.stream);
    await setCachedTicketAttachment(attachmentId, {
      buffer,
      contentType: attachment.mimeType || object.contentType,
      fileName: attachment.fileName,
    });
    return {
      fileName: attachment.fileName,
      mimeType: attachment.mimeType || object.contentType,
      buffer,
    };
  }

  return {
    fileName: attachment.fileName,
    mimeType: attachment.mimeType || object.contentType,
    stream: object.stream,
  };
}

async function readableToBuffer(stream: Readable): Promise<Buffer> {
  return streamToBuffer(stream);
}

export async function assignTicketService(
  user: AuthenticatedUser,
  id: number,
  options: { assignedTo: number | null; selfAssign: boolean },
): Promise<PublicTicket> {
  if (!canAssignTicket(user)) throw forbidden('Solo el equipo de TI puede asignar tickets');

  const row = await findTicketById(id);
  if (!row) throw notFound();
  if (row.status === TICKET_STATUS.CLOSED) {
    throw badRequest('No se puede asignar un ticket cerrado');
  }

  let assigneeId = options.assignedTo;
  if (options.selfAssign) {
    assigneeId = user.id;
  }

  if (assigneeId != null) {
    const isIt = await isItAgentUserId(assigneeId);
    if (!isIt) throw badRequest('Solo usuarios del área de TI pueden ser asignados');
  }

  await updateTicketAssignment(id, assigneeId);

  const updated = await findTicketById(id);
  if (!updated) throw notFound();

  if (assigneeId != null) {
    void notifyTicketAssigned(updated, assigneeId);
  }

  return toPublicTicket(updated);
}

export async function updateTicketStatusService(
  user: AuthenticatedUser,
  id: number,
  status: TicketStatus,
): Promise<PublicTicket> {
  const row = await findTicketById(id);
  if (!row) throw notFound();

  if (status === TICKET_STATUS.CLOSED) {
    if (!canCloseTicket(user, row)) {
      throw forbidden('Solo el solicitante puede cerrar un ticket resuelto');
    }
    await updateTicketStatus(id, TICKET_STATUS.CLOSED, {
      closedAt: new Date(),
    });
  } else if (canManageTicket(user)) {
    if (!canItChangeStatus(row.status, status)) {
      throw badRequest(`No se puede cambiar de ${row.status} a ${status}`);
    }
    const timestamps: { resolvedAt?: Date | null; closedAt?: Date | null } = {};
    if (status === TICKET_STATUS.RESOLVED) {
      timestamps.resolvedAt = new Date();
    }
    if (status !== TICKET_STATUS.RESOLVED && row.status === TICKET_STATUS.RESOLVED) {
      timestamps.resolvedAt = null;
    }
    await updateTicketStatus(id, status, timestamps);

    if (status === TICKET_STATUS.RESOLVED) {
      const resolved = await findTicketById(id);
      if (resolved) void notifyTicketResolved(resolved);
    }
  } else {
    throw forbidden('No tiene permisos para cambiar el estado');
  }

  const updated = await findTicketById(id);
  if (!updated) throw notFound();
  return toPublicTicket(updated);
}

export async function updateTicketPriorityService(
  user: AuthenticatedUser,
  id: number,
  priority: TicketPriority,
): Promise<PublicTicket> {
  if (!canUpdateTicketFields(user)) throw forbidden('Solo TI puede cambiar la prioridad');

  const row = await findTicketById(id);
  if (!row) throw notFound();

  await updateTicketPriority(id, priority);
  const updated = await findTicketById(id);
  if (!updated) throw notFound();
  return toPublicTicket(updated);
}

export async function addTicketCommentService(
  user: AuthenticatedUser,
  id: number,
  message: string,
): Promise<PublicTicketComment> {
  const row = await findTicketById(id);
  if (!row) throw notFound();
  if (!canCommentOnTicket(user, row)) {
    throw forbidden('No puede comentar en este ticket');
  }

  const commentId = await insertTicketComment(id, user.id, message);
  await touchTicketUpdated(id);

  const comments = await listTicketComments(id);
  const comment = comments.find((c) => c.id === commentId);
  if (!comment) throw notFound();

  void notifyTicketComment(row, user, message);

  return toPublicComment(comment, user.id, row);
}

export async function getTicketMetricsService(user: AuthenticatedUser): Promise<TicketMetrics> {
  if (!canManageTicket(user)) throw forbidden('Solo el equipo de TI puede ver métricas');

  const [metrics, byCategory] = await Promise.all([getTicketMetrics(), countTicketsByCategory()]);

  return {
    openCount: metrics.openCount ?? 0,
    inProgressCount: metrics.inProgressCount ?? 0,
    avgResolutionHours:
      metrics.avgResolutionHours != null ? Math.round(metrics.avgResolutionHours * 10) / 10 : null,
    byCategory: byCategory.map((row) => ({
      categoryId: row.categoryId,
      categoryName: row.categoryName,
      count: row.count,
    })),
  };
}

async function notifyTicketCreated(ticket: TicketRow): Promise<void> {
  const itTeam = await listItTeamUserIds();
  const ids = itTeam.map((u) => u.id).filter((id) => id !== ticket.requesterId);
  if (ids.length === 0) return;

  const requesterName = displayName(ticket.requesterFirstName, ticket.requesterLastName);
  await createNotificationsForUsers(
    ids,
    NOTIFICATION_TYPES.TICKET_CREATED,
    'Nuevo ticket de soporte',
    `${ticket.code}: ${ticket.title} — ${requesterName}`,
    NOTIFICATION_RESOURCE_TYPES.TICKET,
    ticket.id,
  );

  for (const member of itTeam) {
    if (member.id === ticket.requesterId) continue;
    notifyEmail(
      () =>
        emailService.sendTicketCreatedToIt(
          member.email,
          displayName(member.firstName, member.lastName),
          ticket.code,
          ticket.title,
          requesterName,
          ticket.id,
        ),
      `ticket-created ${ticket.code}`,
    );
  }
}

async function notifyTicketAssigned(ticket: TicketRow, assigneeId: number): Promise<void> {
  const assignee = await findUserById(assigneeId);
  const requester = await findUserById(ticket.requesterId);
  if (!assignee || !requester) return;

  const assigneeName = displayName(assignee.firstName, assignee.lastName);

  await createNotification(
    assigneeId,
    NOTIFICATION_TYPES.TICKET_ASSIGNED,
    'Ticket asignado',
    `${ticket.code} — ${ticket.title}`,
    NOTIFICATION_RESOURCE_TYPES.TICKET,
    ticket.id,
  );

  if (ticket.requesterId !== assigneeId) {
    await createNotification(
      ticket.requesterId,
      NOTIFICATION_TYPES.TICKET_ASSIGNED,
      'Su ticket fue asignado',
      `${ticket.code} atendido por ${assigneeName}`,
      NOTIFICATION_RESOURCE_TYPES.TICKET,
      ticket.id,
    );
  }

  notifyEmail(
    () =>
      emailService.sendTicketAssigned(
        assignee.email,
        assigneeName,
        ticket.code,
        ticket.title,
        true,
        ticket.id,
      ),
    `ticket-assign ${ticket.code}`,
  );

  if (ticket.requesterId !== assigneeId) {
    notifyEmail(
      () =>
        emailService.sendTicketAssigned(
          requester.email,
          displayName(requester.firstName, requester.lastName),
          ticket.code,
          ticket.title,
          false,
          ticket.id,
        ),
      `ticket-assign-requester ${ticket.code}`,
    );
  }
}

async function notifyTicketComment(
  ticket: TicketRow,
  commenter: AuthenticatedUser,
  messagePreview: string,
): Promise<void> {
  const preview = messagePreview.length > 120 ? `${messagePreview.slice(0, 117)}…` : messagePreview;
  const commenterName = displayName(commenter.firstName, commenter.lastName);

  if (isItAgent(commenter)) {
    if (ticket.requesterId !== commenter.id) {
      await createNotification(
        ticket.requesterId,
        NOTIFICATION_TYPES.TICKET_COMMENT,
        'Nuevo comentario en su ticket',
        `${ticket.code}: ${preview}`,
        NOTIFICATION_RESOURCE_TYPES.TICKET,
        ticket.id,
      );
      const requester = await findUserById(ticket.requesterId);
      if (requester) {
        notifyEmail(
          () =>
            emailService.sendTicketComment(
              requester.email,
              displayName(requester.firstName, requester.lastName),
              ticket.code,
              commenterName,
              preview,
              ticket.id,
              false,
            ),
          `ticket-comment ${ticket.code}`,
        );
      }
    }
    return;
  }

  const itTeam = await listItTeamUserIds();
  const notifyIds = itTeam.map((u) => u.id).filter((id) => id !== commenter.id);

  await createNotificationsForUsers(
    notifyIds,
    NOTIFICATION_TYPES.TICKET_COMMENT,
    'Nuevo comentario en ticket',
    `${ticket.code} — ${commenterName}: ${preview}`,
    NOTIFICATION_RESOURCE_TYPES.TICKET,
    ticket.id,
  );

  for (const member of itTeam) {
    if (member.id === commenter.id) continue;
    notifyEmail(
      () =>
        emailService.sendTicketComment(
          member.email,
          displayName(member.firstName, member.lastName),
          ticket.code,
          commenterName,
          preview,
          ticket.id,
          true,
        ),
      `ticket-comment-it ${ticket.code}`,
    );
  }
}

async function notifyTicketResolved(ticket: TicketRow): Promise<void> {
  await createNotification(
    ticket.requesterId,
    NOTIFICATION_TYPES.TICKET_RESOLVED,
    'Ticket resuelto',
    `${ticket.code}: puede cerrar el ticket si está conforme`,
    NOTIFICATION_RESOURCE_TYPES.TICKET,
    ticket.id,
  );

  const requester = await findUserById(ticket.requesterId);
  if (!requester) return;

  notifyEmail(
    () =>
      emailService.sendTicketResolved(
        requester.email,
        displayName(requester.firstName, requester.lastName),
        ticket.code,
        ticket.title,
        ticket.id,
      ),
    `ticket-resolved ${ticket.code}`,
  );
}
