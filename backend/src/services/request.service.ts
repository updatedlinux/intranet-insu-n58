import type { AppError } from '../middlewares/error.middleware';
import { NOTIFICATION_RESOURCE_TYPES, NOTIFICATION_TYPES } from '../constants/notification-type';
import type { RequestPriority } from '../constants/request-priority';
import { REQUEST_ACTIVE_STATUSES, type RequestStatus } from '../constants/request-status';
import { findAreaById, listAreas } from '../repositories/area.repository';
import { listAreaLeaders } from '../repositories/area-leader.repository';
import { findBoardById } from '../repositories/board.repository';
import {
  allocateRequestCode,
  countSubmittedInAreas,
  createRequest,
  findRequestById,
  insertRequestStatusHistory,
  linkRequestTask,
  listRequestStatusHistory,
  listRequests,
  type RequestRow,
  type RequestStatusHistoryRow,
  updateRequestStatus,
} from '../repositories/request.repository';
import { findTaskById } from '../repositories/task.repository';
import { findUserById } from '../repositories/user.repository';
import {
  canAccessInbox,
  canCloseAsRequester,
  canManageRequest,
  canViewRequest,
  getInboxAreaIds,
} from '../policies/request-access.policy';
import type { AuthenticatedUser } from '../types/auth';
import { createNotification, createNotificationsForUsers } from './notification.service';
import { displayName, emailService, notifyEmail } from './email.service';

function forbidden(message: string): AppError {
  const error = new Error(message) as AppError;
  error.statusCode = 403;
  return error;
}

function notFound(message: string): AppError {
  const error = new Error(message) as AppError;
  error.statusCode = 404;
  return error;
}

function badRequest(message: string): AppError {
  const error = new Error(message) as AppError;
  error.statusCode = 400;
  return error;
}

const LEADER_TRANSITIONS: Partial<Record<RequestStatus, RequestStatus[]>> = {
  SUBMITTED: ['RECEIVED', 'REJECTED'],
  RECEIVED: ['IN_PROGRESS', 'REJECTED'],
  IN_PROGRESS: ['RESOLVED', 'REJECTED'],
};

export interface PublicRequest {
  id: number;
  code: string;
  requesterId: number;
  requesterName: string;
  requesterAreaName: string;
  targetAreaId: number;
  targetAreaName: string;
  title: string;
  description: string;
  category: string | null;
  priority: RequestPriority;
  status: RequestStatus;
  rejectionReason: string | null;
  linkedTaskId: number | null;
  linkedTaskTitle: string | null;
  linkedTaskBoardId: number | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  closedAt: string | null;
}

export interface PublicRequestStatusHistory {
  id: number;
  fromStatus: RequestStatus | null;
  toStatus: RequestStatus;
  comment: string | null;
  changedByName: string;
  createdAt: string;
}

function toPublicRequest(row: RequestRow): PublicRequest {
  return {
    id: row.id,
    code: row.code,
    requesterId: row.requesterId,
    requesterName: displayName(row.requesterFirstName, row.requesterLastName),
    requesterAreaName: row.requesterAreaName,
    targetAreaId: row.targetAreaId,
    targetAreaName: row.targetAreaName,
    title: row.title,
    description: row.description,
    category: row.category,
    priority: row.priority,
    status: row.status,
    rejectionReason: row.rejectionReason,
    linkedTaskId: row.linkedTaskId,
    linkedTaskTitle: row.linkedTaskTitle,
    linkedTaskBoardId: row.linkedTaskBoardId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    resolvedAt: row.resolvedAt?.toISOString() ?? null,
    closedAt: row.closedAt?.toISOString() ?? null,
  };
}

function toPublicHistory(row: RequestStatusHistoryRow): PublicRequestStatusHistory {
  return {
    id: row.id,
    fromStatus: row.fromStatus,
    toStatus: row.toStatus,
    comment: row.comment,
    changedByName: displayName(row.changerFirstName, row.changerLastName),
    createdAt: row.createdAt.toISOString(),
  };
}

async function assertActiveTargetArea(targetAreaId: number): Promise<void> {
  const area = await findAreaById(targetAreaId);
  if (!area || !area.isActive) {
    throw badRequest('El área destino no existe o no está activa');
  }
}

function validateTransition(
  current: RequestStatus,
  next: RequestStatus,
  isRequesterClose: boolean,
): void {
  if (isRequesterClose) {
    if (current !== 'RESOLVED' || next !== 'CLOSED') {
      throw badRequest('Solo puede cerrar solicitudes resueltas');
    }
    return;
  }

  if (next === 'REJECTED') {
    if (!REQUEST_ACTIVE_STATUSES.includes(current)) {
      throw badRequest('No se puede rechazar esta solicitud');
    }
    return;
  }

  const allowed = LEADER_TRANSITIONS[current];
  if (!allowed?.includes(next)) {
    throw badRequest(`Transición no permitida: ${current} → ${next}`);
  }
}

async function notifyRequestCreated(request: RequestRow): Promise<void> {
  const requester = await findUserById(request.requesterId);
  if (requester) {
    await createNotification(
      request.requesterId,
      NOTIFICATION_TYPES.REQUEST_CREATED,
      'Solicitud enviada',
      `Tu solicitud ${request.code} fue enviada correctamente`,
      NOTIFICATION_RESOURCE_TYPES.REQUEST,
      request.id,
    );
    notifyEmail(
      () =>
        emailService.sendRequestCreatedToRequester(
          requester.email,
          displayName(requester.firstName, requester.lastName),
          request.code,
          request.id,
        ),
      `request-created-requester ${request.code}`,
    );
  }

  const leaders = await listAreaLeaders(request.targetAreaId);
  const leaderIds = leaders.map((l) => l.id);
  if (leaderIds.length > 0) {
    await createNotificationsForUsers(
      leaderIds,
      NOTIFICATION_TYPES.REQUEST_CREATED,
      'Nueva solicitud recibida',
      `${request.title}`,
      NOTIFICATION_RESOURCE_TYPES.REQUEST,
      request.id,
    );
    for (const leader of leaders) {
      notifyEmail(
        () =>
          emailService.sendRequestCreatedToLeader(
            leader.email,
            displayName(leader.firstName, leader.lastName),
            request.title,
            request.code,
            request.id,
          ),
        `request-created-leader ${request.code}`,
      );
    }
  }
}

async function notifyStatusChange(
  request: RequestRow,
  toStatus: RequestStatus,
  rejectionReason: string | null,
): Promise<void> {
  const requester = await findUserById(request.requesterId);
  if (!requester) return;

  const requesterName = displayName(requester.firstName, requester.lastName);

  switch (toStatus) {
    case 'RECEIVED': {
      await createNotification(
        request.requesterId,
        NOTIFICATION_TYPES.REQUEST_RECEIVED,
        'Solicitud recibida',
        `Tu solicitud ${request.code} fue recibida por ${request.targetAreaName}`,
        NOTIFICATION_RESOURCE_TYPES.REQUEST,
        request.id,
      );
      notifyEmail(
        () =>
          emailService.sendRequestStatusToRequester(
            requester.email,
            requesterName,
            request.code,
            `fue recibida por ${request.targetAreaName}`,
            request.id,
          ),
        `request-received ${request.code}`,
      );
      break;
    }
    case 'IN_PROGRESS': {
      await createNotification(
        request.requesterId,
        NOTIFICATION_TYPES.REQUEST_IN_PROGRESS,
        'Solicitud en proceso',
        `Tu solicitud ${request.code} está siendo procesada`,
        NOTIFICATION_RESOURCE_TYPES.REQUEST,
        request.id,
      );
      notifyEmail(
        () =>
          emailService.sendRequestStatusToRequester(
            requester.email,
            requesterName,
            request.code,
            'está siendo procesada',
            request.id,
          ),
        `request-in-progress ${request.code}`,
      );
      break;
    }
    case 'RESOLVED': {
      await createNotification(
        request.requesterId,
        NOTIFICATION_TYPES.REQUEST_RESOLVED,
        'Solicitud resuelta',
        `Tu solicitud ${request.code} fue resuelta. Puedes cerrarla desde tu bandeja.`,
        NOTIFICATION_RESOURCE_TYPES.REQUEST,
        request.id,
      );
      notifyEmail(
        () =>
          emailService.sendRequestResolvedToRequester(
            requester.email,
            requesterName,
            request.code,
            request.id,
          ),
        `request-resolved ${request.code}`,
      );
      break;
    }
    case 'REJECTED': {
      const reason = rejectionReason ?? request.rejectionReason ?? 'Sin motivo indicado';
      await createNotification(
        request.requesterId,
        NOTIFICATION_TYPES.REQUEST_REJECTED,
        'Solicitud rechazada',
        `Tu solicitud ${request.code} fue rechazada`,
        NOTIFICATION_RESOURCE_TYPES.REQUEST,
        request.id,
      );
      notifyEmail(
        () =>
          emailService.sendRequestRejectedToRequester(
            requester.email,
            requesterName,
            request.code,
            reason,
            request.id,
          ),
        `request-rejected ${request.code}`,
      );
      break;
    }
    case 'CLOSED': {
      const leaders = await listAreaLeaders(request.targetAreaId);
      const leaderIds = leaders.map((l) => l.id).filter((id) => id !== request.requesterId);
      if (leaderIds.length > 0) {
        await createNotificationsForUsers(
          leaderIds,
          NOTIFICATION_TYPES.REQUEST_CLOSED,
          'Solicitud cerrada',
          `La solicitud ${request.code} fue cerrada por el solicitante`,
          NOTIFICATION_RESOURCE_TYPES.REQUEST,
          request.id,
        );
      }
      for (const leader of leaders) {
        if (leader.id === request.requesterId) continue;
        notifyEmail(
          () =>
            emailService.sendRequestClosedToLeader(
              leader.email,
              displayName(leader.firstName, leader.lastName),
              request.code,
              request.id,
            ),
          `request-closed-leader ${request.code}`,
        );
      }
      break;
    }
    default:
      break;
  }
}

export async function listTargetAreasService(): Promise<{ items: { id: number; name: string }[] }> {
  const rows = await listAreas({ isActive: true });
  return { items: rows.map((a) => ({ id: a.id, name: a.name })) };
}

export async function createRequestService(
  user: AuthenticatedUser,
  input: {
    targetAreaId: number;
    title: string;
    description: string;
    category: string | null;
    priority: RequestPriority;
  },
): Promise<PublicRequest> {
  await assertActiveTargetArea(input.targetAreaId);

  const code = await allocateRequestCode();
  const id = await createRequest({
    code,
    requesterId: user.id,
    targetAreaId: input.targetAreaId,
    title: input.title,
    description: input.description,
    category: input.category,
    priority: input.priority,
  });

  await insertRequestStatusHistory({
    requestId: id,
    changedBy: user.id,
    fromStatus: null,
    toStatus: 'SUBMITTED',
    comment: null,
  });

  const row = await findRequestById(id);
  if (!row) throw notFound('Solicitud no encontrada');

  await notifyRequestCreated(row);
  return toPublicRequest(row);
}

export async function listMyRequestsService(
  user: AuthenticatedUser,
  filters: {
    status?: RequestStatus;
    targetAreaId?: number;
    fromDate?: Date;
    toDate?: Date;
  },
): Promise<{ items: PublicRequest[] }> {
  const rows = await listRequests({
    requesterId: user.id,
    status: filters.status,
    targetAreaId: filters.targetAreaId,
    fromDate: filters.fromDate,
    toDate: filters.toDate,
  });
  return { items: rows.map(toPublicRequest) };
}

export async function listInboxRequestsService(
  user: AuthenticatedUser,
  filters: {
    status?: RequestStatus;
    priority?: RequestPriority;
    requesterId?: number;
  },
): Promise<{ items: PublicRequest[]; submittedCount: number }> {
  if (!canAccessInbox(user)) throw forbidden('No tiene acceso a la bandeja de solicitudes');

  const areaIds = await getInboxAreaIds(user);
  if (areaIds !== 'all' && areaIds.length === 0) {
    return { items: [], submittedCount: 0 };
  }

  const rows = await listRequests({
    targetAreaIds: areaIds === 'all' ? undefined : areaIds,
    status: filters.status,
    priority: filters.priority,
    requesterId: filters.requesterId,
  });

  const submittedCount =
    areaIds === 'all'
      ? (await listRequests({ status: 'SUBMITTED' })).length
      : await countSubmittedInAreas(areaIds);

  return {
    items: rows.map(toPublicRequest),
    submittedCount,
  };
}

export async function getRequestService(
  user: AuthenticatedUser,
  id: number,
): Promise<{
  item: PublicRequest;
  history: PublicRequestStatusHistory[];
  capabilities: { canManage: boolean; canClose: boolean };
}> {
  const row = await findRequestById(id);
  if (!row) throw notFound('Solicitud no encontrada');
  if (!(await canViewRequest(user, row))) throw forbidden('No tiene acceso a esta solicitud');

  const history = await listRequestStatusHistory(id);
  return {
    item: toPublicRequest(row),
    history: history.map(toPublicHistory),
    capabilities: {
      canManage: await canManageRequest(user, row),
      canClose: canCloseAsRequester(user, row),
    },
  };
}

export async function updateRequestStatusService(
  user: AuthenticatedUser,
  id: number,
  input: {
    status: RequestStatus;
    comment: string | null;
    rejectionReason: string | null;
  },
): Promise<{ item: PublicRequest; history: PublicRequestStatusHistory[] }> {
  const row = await findRequestById(id);
  if (!row) throw notFound('Solicitud no encontrada');

  const isRequesterClose =
    row.requesterId === user.id && input.status === 'CLOSED' && row.status === 'RESOLVED';

  if (isRequesterClose) {
    if (!canCloseAsRequester(user, row)) {
      throw forbidden('Solo puede cerrar solicitudes resueltas propias');
    }
  } else if (!(await canManageRequest(user, row))) {
    throw forbidden('Solo el líder del área destino o un administrador puede cambiar el estado');
  }

  validateTransition(row.status, input.status, isRequesterClose);

  const extra: {
    rejectionReason?: string | null;
    resolvedAt?: Date | null;
    closedAt?: Date | null;
  } = {};

  if (input.status === 'REJECTED') {
    extra.rejectionReason = input.rejectionReason;
  }
  if (input.status === 'RESOLVED') {
    extra.resolvedAt = new Date();
  }
  if (input.status === 'CLOSED') {
    extra.closedAt = new Date();
  }

  await updateRequestStatus(id, input.status, extra);

  await insertRequestStatusHistory({
    requestId: id,
    changedBy: user.id,
    fromStatus: row.status,
    toStatus: input.status,
    comment: input.comment,
  });

  const updated = await findRequestById(id);
  if (!updated) throw notFound('Solicitud no encontrada');

  await notifyStatusChange(updated, input.status, input.rejectionReason);

  const history = await listRequestStatusHistory(id);
  return {
    item: toPublicRequest(updated),
    history: history.map(toPublicHistory),
  };
}

export async function linkRequestTaskService(
  user: AuthenticatedUser,
  id: number,
  linkedTaskId: number,
): Promise<{ item: PublicRequest; linkedTask: { id: number; title: string; boardId: number } }> {
  const row = await findRequestById(id);
  if (!row) throw notFound('Solicitud no encontrada');
  if (!(await canManageRequest(user, row))) {
    throw forbidden('Solo el líder del área destino o un administrador puede vincular tareas');
  }

  const task = await findTaskById(linkedTaskId);
  if (!task) throw notFound('Tarea no encontrada');

  const board = await findBoardById(task.boardId);
  if (!board || board.areaId !== row.targetAreaId) {
    throw badRequest('La tarea debe pertenecer al tablero del área destino');
  }

  await linkRequestTask(id, linkedTaskId);

  const updated = await findRequestById(id);
  if (!updated) throw notFound('Solicitud no encontrada');

  return {
    item: toPublicRequest(updated),
    linkedTask: { id: task.id, title: task.title, boardId: task.boardId },
  };
}
