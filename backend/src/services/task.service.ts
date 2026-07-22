import type { Readable } from 'node:stream';
import { buffer as streamToBuffer } from 'node:stream/consumers';
import { TASK_ACTIVITY_ACTIONS } from '../constants/task-activity-action';
import { NOTIFICATION_RESOURCE_TYPES, NOTIFICATION_TYPES } from '../constants/notification-type';
import { TASK_PRIORITY_LABELS, type TaskPriority } from '../constants/task-priority';
import { TASK_STATUS, TASK_STATUS_LABELS, type TaskStatus } from '../constants/task-status';
import type { AppError } from '../middlewares/error.middleware';
import {
  canArchiveTask,
  canAssignUserToBoardTask,
  canEditTask,
  canMoveTask,
} from '../policies/board-access.policy';
import { canAccessBoard } from '../policies/board-access.policy';
import { findBoardById, findColumnById } from '../repositories/board.repository';
import { findUserById } from '../repositories/user.repository';
import {
  archiveTask,
  deleteTaskAttachment,
  findTaskAttachmentById,
  findTaskById,
  getMaxTaskOrderInColumn,
  insertTask,
  insertTaskActivity,
  insertTaskAttachment,
  insertTaskComment,
  listTaskActivity,
  listTaskAssignees,
  listTaskAttachments,
  listTaskComments,
  listTaskTags,
  listTasksByBoardId,
  moveTask,
  reorderTasksInColumn,
  setTaskAssignees,
  setTaskTags,
  updateTask,
  type TaskActivityRow,
  type TaskAttachmentRow,
  type TaskCommentRow,
  type TaskRow,
} from '../repositories/task.repository';
import type { AuthenticatedUser } from '../types/auth';
import { displayName, emailService, notifyEmail } from './email.service';
import { createNotification, createNotificationsForUsers } from './notification.service';
import {
  deleteTaskAttachmentObject,
  getTaskAttachmentObject,
  uploadTaskAttachmentObject,
} from './task-attachment-storage.service';
import { getCachedTaskAttachment, setCachedTaskAttachment } from './task-attachment-cache.service';
import type { TaskUploadFile } from '../utils/task-files';
import { validateTaskAttachment } from '../utils/task-files';

function notFound(message = 'Tarea no encontrada'): AppError {
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

export interface PublicTaskDetail {
  id: number;
  boardId: number;
  columnId: number;
  title: string;
  description: string | null;
  priority: TaskPriority;
  priorityLabel: string;
  status: TaskStatus;
  statusLabel: string;
  color: string | null;
  dueDate: string | null;
  createdBy: number;
  creatorName: string;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
  completedAt: string | null;
  order: number;
  assignees: { userId: number; firstName: string; lastName: string; areaName: string }[];
  tags: { tagId: number; tagName: string }[];
}

export interface PublicTaskComment {
  id: number;
  taskId: number;
  userId: number;
  authorName: string;
  authorAreaName: string;
  message: string;
  createdAt: string;
  isOwn: boolean;
}

export interface PublicTaskAttachment {
  id: number;
  taskId: number;
  fileName: string;
  fileType: string;
  fileSize: number;
  uploadedBy: number;
  uploaderName: string;
  createdAt: string;
}

export interface PublicTaskActivity {
  id: number;
  userId: number;
  authorName: string;
  action: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface ServedTaskAttachment {
  fileName: string;
  mimeType: string;
  buffer?: Buffer;
  stream?: Readable;
}

function toPublicTask(row: TaskRow): PublicTaskDetail {
  return {
    id: row.id,
    boardId: row.boardId,
    columnId: row.columnId,
    title: row.title,
    description: row.description,
    priority: row.priority,
    priorityLabel: TASK_PRIORITY_LABELS[row.priority],
    status: row.status,
    statusLabel: TASK_STATUS_LABELS[row.status],
    color: row.color,
    dueDate: row.dueDate?.toISOString() ?? null,
    createdBy: row.createdBy,
    creatorName: displayName(row.creatorFirstName, row.creatorLastName),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    archivedAt: row.archivedAt?.toISOString() ?? null,
    completedAt: row.completedAt?.toISOString() ?? null,
    order: row.order,
    assignees: [],
    tags: [],
  };
}

function toPublicComment(row: TaskCommentRow, viewerId: number): PublicTaskComment {
  return {
    id: row.id,
    taskId: row.taskId,
    userId: row.userId,
    authorName: displayName(row.authorFirstName, row.authorLastName),
    authorAreaName: row.authorAreaName,
    message: row.message,
    createdAt: row.createdAt.toISOString(),
    isOwn: row.userId === viewerId,
  };
}

function toPublicAttachment(row: TaskAttachmentRow): PublicTaskAttachment {
  return {
    id: row.id,
    taskId: row.taskId,
    fileName: row.fileName,
    fileType: row.fileType,
    fileSize: Number(row.fileSize),
    uploadedBy: row.uploadedBy,
    uploaderName: displayName(row.uploaderFirstName, row.uploaderLastName),
    createdAt: row.createdAt.toISOString(),
  };
}

function toPublicActivity(row: TaskActivityRow): PublicTaskActivity {
  let metadata: Record<string, unknown> | null = null;
  if (row.metadata) {
    try {
      metadata = JSON.parse(row.metadata) as Record<string, unknown>;
    } catch {
      metadata = null;
    }
  }
  return {
    id: row.id,
    userId: row.userId,
    authorName: displayName(row.authorFirstName, row.authorLastName),
    action: row.action,
    metadata,
    createdAt: row.createdAt.toISOString(),
  };
}

async function assertBoardAccess(user: AuthenticatedUser, boardId: number) {
  const board = await findBoardById(boardId);
  if (!board) throw notFound('Tablero no encontrado');
  if (!(await canAccessBoard(user, board))) throw forbidden('No tiene acceso a este tablero');
  return board;
}

async function assertTaskAccess(user: AuthenticatedUser, taskId: number) {
  const task = await findTaskById(taskId);
  if (!task) throw notFound();
  const board = await findBoardById(task.boardId);
  if (!board) throw notFound('Tablero no encontrado');
  if (!(await canAccessBoard(user, board))) throw forbidden('No tiene acceso a esta tarea');
  return { task, board };
}

async function validateAssignees(
  user: AuthenticatedUser,
  boardAreaId: number,
  assigneeIds: number[],
): Promise<void> {
  for (const assigneeId of assigneeIds) {
    const assignee = await findUserById(assigneeId);
    if (!assignee?.isActive) throw badRequest('Asignado inválido o inactivo');
    const allowed = await canAssignUserToBoardTask(user, boardAreaId, assignee.areaId);
    if (!allowed) throw forbidden('No puede asignar a usuarios fuera de su área permitida');
  }
}

export async function createTaskService(
  user: AuthenticatedUser,
  data: {
    boardId: number;
    columnId: number;
    title: string;
    description: string | null;
    priority: TaskPriority;
    color: string | null;
    dueDate: Date | null;
    assigneeIds: number[];
    tagIds: number[];
  },
): Promise<PublicTaskDetail> {
  const board = await assertBoardAccess(user, data.boardId);

  const column = await findColumnById(data.columnId);
  if (!column || column.boardId !== data.boardId) {
    throw badRequest('Columna inválida para este tablero');
  }

  await validateAssignees(user, board.areaId, data.assigneeIds);

  const maxOrder = await getMaxTaskOrderInColumn(data.columnId);
  const taskId = await insertTask({
    boardId: data.boardId,
    columnId: data.columnId,
    title: data.title,
    description: data.description,
    priority: data.priority,
    status: column.defaultStatus,
    color: data.color,
    dueDate: data.dueDate,
    createdBy: user.id,
    order: maxOrder + 1,
  });

  if (data.assigneeIds.length > 0) {
    await setTaskAssignees(taskId, data.assigneeIds);
  }
  if (data.tagIds.length > 0) {
    await setTaskTags(taskId, data.tagIds);
  }

  await insertTaskActivity(taskId, user.id, TASK_ACTIVITY_ACTIONS.CREATED, {
    title: data.title,
    columnId: data.columnId,
  });

  const row = await findTaskById(taskId);
  if (!row) throw notFound();

  void notifyTaskCreated(row, data.assigneeIds, user);

  const [assignees, tags] = await Promise.all([listTaskAssignees(taskId), listTaskTags(taskId)]);
  return { ...toPublicTask(row), assignees, tags };
}

export async function getTaskDetailService(
  user: AuthenticatedUser,
  taskId: number,
): Promise<{
  item: PublicTaskDetail;
  comments: PublicTaskComment[];
  attachments: PublicTaskAttachment[];
  activity: PublicTaskActivity[];
}> {
  const { task } = await assertTaskAccess(user, taskId);

  const [assignees, tags, comments, attachments, activity] = await Promise.all([
    listTaskAssignees(taskId),
    listTaskTags(taskId),
    listTaskComments(taskId),
    listTaskAttachments(taskId),
    listTaskActivity(taskId),
  ]);

  return {
    item: { ...toPublicTask(task), assignees, tags },
    comments: comments.map((c) => toPublicComment(c, user.id)),
    attachments: attachments.map(toPublicAttachment),
    activity: activity.map(toPublicActivity),
  };
}

export async function updateTaskService(
  user: AuthenticatedUser,
  taskId: number,
  data: {
    title?: string;
    description?: string | null;
    priority?: TaskPriority;
    color?: string | null;
    dueDate?: Date | null;
    tagIds?: number[];
  },
): Promise<PublicTaskDetail> {
  const { task, board } = await assertTaskAccess(user, taskId);
  if (!(await canEditTask(user, task, board))) {
    throw forbidden('No puede editar esta tarea');
  }
  if (task.archivedAt) throw badRequest('No puede editar una tarea archivada');

  await updateTask(taskId, data);
  if (data.tagIds !== undefined) {
    await setTaskTags(taskId, data.tagIds);
  }

  await insertTaskActivity(taskId, user.id, TASK_ACTIVITY_ACTIONS.UPDATED, {
    fields: Object.keys(data),
  });

  const updated = await findTaskById(taskId);
  if (!updated) throw notFound();
  const [assignees, tags] = await Promise.all([listTaskAssignees(taskId), listTaskTags(taskId)]);
  return { ...toPublicTask(updated), assignees, tags };
}

export async function moveTaskService(
  user: AuthenticatedUser,
  taskId: number,
  data: { columnId: number; order: number; taskOrders?: { taskId: number; order: number }[] },
): Promise<PublicTaskDetail> {
  const { task, board } = await assertTaskAccess(user, taskId);
  if (!(await canMoveTask(user, task, board))) {
    throw forbidden('No puede mover esta tarea');
  }
  if (task.archivedAt) throw badRequest('No puede mover una tarea archivada');

  const destColumn = await findColumnById(data.columnId);
  if (!destColumn || destColumn.boardId !== task.boardId) {
    throw badRequest('Columna destino inválida');
  }

  const fromColumn = await findColumnById(task.columnId);
  const fromColumnName = fromColumn?.name ?? '';
  const toColumnName = destColumn.name;

  const newStatus = destColumn.defaultStatus;
  const completedAt =
    newStatus === TASK_STATUS.DONE
      ? new Date()
      : task.status === TASK_STATUS.DONE
        ? null
        : task.completedAt;

  const sourceColumnId = task.columnId;

  await moveTask(taskId, data.columnId, newStatus, data.order, completedAt);

  if (data.taskOrders && data.taskOrders.length > 0) {
    await reorderTasksInColumn(data.columnId, data.taskOrders);
  }

  if (sourceColumnId !== data.columnId) {
    const boardTasks = await listTasksByBoardId(task.boardId);
    const sourceTasks = boardTasks
      .filter((t) => t.columnId === sourceColumnId && !t.archivedAt)
      .sort((a, b) => a.order - b.order || a.id - b.id);
    const sourceOrders = sourceTasks.map((t, order) => ({ taskId: t.id, order }));
    if (sourceOrders.length > 0) {
      await reorderTasksInColumn(sourceColumnId, sourceOrders);
    }
  }

  if (newStatus !== task.status) {
    await insertTaskActivity(taskId, user.id, TASK_ACTIVITY_ACTIONS.STATUS_CHANGED, {
      from: task.status,
      to: newStatus,
    });
  }

  await insertTaskActivity(taskId, user.id, TASK_ACTIVITY_ACTIONS.MOVED, {
    fromColumnId: sourceColumnId,
    fromColumnName,
    toColumnId: data.columnId,
    toColumnName,
    order: data.order,
  });

  const updated = await findTaskById(taskId);
  if (!updated) throw notFound();

  void notifyTaskMoved(updated, user.id, {
    fromColumnName,
    toColumnName,
    fromStatus: task.status,
    toStatus: newStatus,
  });

  const [assignees, tags] = await Promise.all([listTaskAssignees(taskId), listTaskTags(taskId)]);
  return { ...toPublicTask(updated), assignees, tags };
}

export async function assignTaskService(
  user: AuthenticatedUser,
  taskId: number,
  data: { addIds: number[]; removeIds: number[] },
): Promise<PublicTaskDetail> {
  const { task, board } = await assertTaskAccess(user, taskId);
  if (!(await canEditTask(user, task, board))) {
    throw forbidden('No puede modificar asignados de esta tarea');
  }
  if (task.archivedAt) throw badRequest('No puede modificar una tarea archivada');

  await validateAssignees(user, board.areaId, data.addIds);

  const current = await listTaskAssignees(taskId);
  const currentIds = new Set(current.map((a) => a.userId));
  for (const id of data.removeIds) currentIds.delete(id);
  for (const id of data.addIds) currentIds.add(id);

  await setTaskAssignees(taskId, [...currentIds]);

  await insertTaskActivity(taskId, user.id, TASK_ACTIVITY_ACTIONS.ASSIGNED, {
    added: data.addIds,
    removed: data.removeIds,
  });

  if (data.addIds.length > 0) {
    const updated = await findTaskById(taskId);
    if (updated) void notifyTaskAssigned(updated, data.addIds, user);
  }

  const updated = await findTaskById(taskId);
  if (!updated) throw notFound();
  const [assignees, tags] = await Promise.all([listTaskAssignees(taskId), listTaskTags(taskId)]);
  return { ...toPublicTask(updated), assignees, tags };
}

export async function addTaskCommentService(
  user: AuthenticatedUser,
  taskId: number,
  message: string,
): Promise<PublicTaskComment> {
  const { task, board } = await assertTaskAccess(user, taskId);
  if (!(await canAccessBoard(user, board))) throw forbidden('No puede comentar en esta tarea');
  if (task.archivedAt) throw badRequest('No puede comentar en una tarea archivada');

  const commentId = await insertTaskComment(taskId, user.id, message);
  await insertTaskActivity(taskId, user.id, TASK_ACTIVITY_ACTIONS.COMMENTED, {
    preview: message.slice(0, 120),
  });

  void notifyTaskComment(task, user, message);

  const comments = await listTaskComments(taskId);
  const comment = comments.find((c) => c.id === commentId);
  if (!comment) throw notFound();
  return toPublicComment(comment, user.id);
}

export async function uploadTaskAttachmentService(
  user: AuthenticatedUser,
  taskId: number,
  file: TaskUploadFile,
): Promise<PublicTaskAttachment> {
  const { task, board } = await assertTaskAccess(user, taskId);
  if (!(await canEditTask(user, task, board))) {
    throw forbidden('No puede adjuntar archivos a esta tarea');
  }
  if (task.archivedAt) throw badRequest('No puede adjuntar a una tarea archivada');

  try {
    validateTaskAttachment(file);
  } catch (error) {
    throw badRequest(error instanceof Error ? error.message : 'Archivo inválido');
  }

  const { fileKey } = await uploadTaskAttachmentObject(
    taskId,
    file.buffer,
    file.mimetype,
    file.originalname,
  );

  const attachmentId = await insertTaskAttachment({
    taskId,
    uploadedBy: user.id,
    fileName: file.originalname,
    fileKey,
    fileType: file.mimetype,
    fileSize: file.size,
  });

  await insertTaskActivity(taskId, user.id, TASK_ACTIVITY_ACTIONS.ATTACHMENT_ADDED, {
    fileName: file.originalname,
  });

  const attachment = await findTaskAttachmentById(attachmentId);
  if (!attachment) throw notFound();
  return toPublicAttachment(attachment);
}

export async function deleteTaskAttachmentService(
  user: AuthenticatedUser,
  taskId: number,
  attachmentId: number,
): Promise<void> {
  const { task, board } = await assertTaskAccess(user, taskId);
  if (!(await canEditTask(user, task, board))) {
    throw forbidden('No puede eliminar adjuntos de esta tarea');
  }

  const attachment = await findTaskAttachmentById(attachmentId);
  if (!attachment || attachment.taskId !== taskId) throw notFound('Adjunto no encontrado');

  await deleteTaskAttachment(attachmentId);
  try {
    await deleteTaskAttachmentObject(attachment.fileKey);
  } catch (error) {
    console.error('[tasks] Error al eliminar adjunto de almacenamiento:', error);
  }
}

export async function serveTaskAttachmentService(
  user: AuthenticatedUser,
  taskId: number,
  attachmentId: number,
): Promise<ServedTaskAttachment> {
  await assertTaskAccess(user, taskId);

  const attachment = await findTaskAttachmentById(attachmentId);
  if (!attachment || attachment.taskId !== taskId) throw notFound('Adjunto no encontrado');

  const cached = await getCachedTaskAttachment(attachmentId);
  if (cached) {
    return {
      fileName: cached.fileName,
      mimeType: cached.contentType,
      buffer: cached.buffer,
    };
  }

  const object = await getTaskAttachmentObject(attachment.fileKey);
  const knownSize = attachment.fileSize ?? object.contentLength ?? 0;

  if (knownSize > 0 && knownSize <= 1024 * 1024) {
    const buffer = await streamToBuffer(object.stream);
    await setCachedTaskAttachment(attachmentId, {
      buffer,
      contentType: attachment.fileType || object.contentType,
      fileName: attachment.fileName,
    });
    return {
      fileName: attachment.fileName,
      mimeType: attachment.fileType || object.contentType,
      buffer,
    };
  }

  return {
    fileName: attachment.fileName,
    mimeType: attachment.fileType || object.contentType,
    stream: object.stream,
  };
}

export async function archiveTaskService(
  user: AuthenticatedUser,
  taskId: number,
): Promise<PublicTaskDetail> {
  const { task, board } = await assertTaskAccess(user, taskId);
  if (!(await canArchiveTask(user, board))) {
    throw forbidden('Solo líderes o administradores pueden archivar tareas');
  }
  if (task.archivedAt) throw badRequest('La tarea ya está archivada');

  await archiveTask(taskId);
  await insertTaskActivity(taskId, user.id, TASK_ACTIVITY_ACTIONS.ARCHIVED, {});

  const updated = await findTaskById(taskId);
  if (!updated) throw notFound();
  const [assignees, tags] = await Promise.all([listTaskAssignees(taskId), listTaskTags(taskId)]);
  return { ...toPublicTask(updated), assignees, tags };
}

async function getTaskParticipantIds(task: TaskRow): Promise<number[]> {
  const assignees = await listTaskAssignees(task.id);
  const ids = new Set<number>([task.createdBy, ...assignees.map((a) => a.userId)]);
  return [...ids];
}

async function emailTaskParticipants(
  task: TaskRow,
  recipientIds: number[],
  context: string,
  buildSend: (user: {
    email: string;
    firstName: string;
    lastName: string;
  }) => () => Promise<boolean>,
): Promise<void> {
  for (const userId of recipientIds) {
    const user = await findUserById(userId);
    if (!user?.email) continue;
    notifyEmail(buildSend(user), `${context} ${task.id} user ${userId}`);
  }
}

async function notifyTaskCreated(
  task: TaskRow,
  assigneeIds: number[],
  creator: AuthenticatedUser,
): Promise<void> {
  const creatorName = displayName(creator.firstName, creator.lastName);

  for (const assigneeId of assigneeIds) {
    if (assigneeId === creator.id) continue;

    await createNotification(
      assigneeId,
      NOTIFICATION_TYPES.TASK_ASSIGNED,
      'Nueva tarea asignada',
      `${task.title} — creada por ${creatorName}`,
      NOTIFICATION_RESOURCE_TYPES.TASK,
      task.id,
    );
  }

  const emailRecipients = assigneeIds.filter((id) => id !== creator.id);
  await emailTaskParticipants(
    task,
    emailRecipients,
    'task-created',
    (user) => () =>
      emailService.sendTaskCreated(
        user.email,
        displayName(user.firstName, user.lastName),
        task.title,
        creatorName,
        task.id,
      ),
  );
}

async function notifyTaskAssigned(
  task: TaskRow,
  newAssigneeIds: number[],
  assigner: AuthenticatedUser,
): Promise<void> {
  const assignerName = displayName(assigner.firstName, assigner.lastName);

  for (const assigneeId of newAssigneeIds) {
    if (assigneeId === assigner.id) continue;

    await createNotification(
      assigneeId,
      NOTIFICATION_TYPES.TASK_ASSIGNED,
      'Tarea asignada',
      `${task.title} — asignada por ${assignerName}`,
      NOTIFICATION_RESOURCE_TYPES.TASK,
      task.id,
    );
  }

  const emailRecipients = newAssigneeIds.filter((id) => id !== assigner.id);
  await emailTaskParticipants(
    task,
    emailRecipients,
    'task-assigned',
    (user) => () =>
      emailService.sendTaskAssigned(
        user.email,
        displayName(user.firstName, user.lastName),
        task.title,
        assignerName,
        task.id,
      ),
  );
}

async function notifyTaskMoved(
  task: TaskRow,
  moverId: number,
  details: {
    fromColumnName: string;
    toColumnName: string;
    fromStatus: TaskStatus;
    toStatus: TaskStatus;
  },
): Promise<void> {
  const participantIds = (await getTaskParticipantIds(task)).filter((id) => id !== moverId);
  if (participantIds.length === 0) return;

  const mover = await findUserById(moverId);
  const moverName = mover ? displayName(mover.firstName, mover.lastName) : 'Un colaborador';
  const isCompleted =
    details.toStatus === TASK_STATUS.DONE && details.fromStatus !== TASK_STATUS.DONE;
  const notificationTitle = isCompleted ? 'Tarea completada' : 'Tarea movida';
  const notificationBody = isCompleted
    ? `${task.title} — completada por ${moverName}`
    : `${task.title} — movida por ${moverName}`;

  await createNotificationsForUsers(
    participantIds,
    NOTIFICATION_TYPES.TASK_MOVED,
    notificationTitle,
    notificationBody,
    NOTIFICATION_RESOURCE_TYPES.TASK,
    task.id,
  );

  const statusLabel = TASK_STATUS_LABELS[details.toStatus];
  if (isCompleted) {
    await emailTaskParticipants(
      task,
      participantIds,
      'task-completed',
      (user) => () =>
        emailService.sendTaskCompleted(
          user.email,
          displayName(user.firstName, user.lastName),
          task.title,
          moverName,
          task.id,
        ),
    );
    return;
  }

  await emailTaskParticipants(
    task,
    participantIds,
    'task-moved',
    (user) => () =>
      emailService.sendTaskMoved(
        user.email,
        displayName(user.firstName, user.lastName),
        task.title,
        moverName,
        details.fromColumnName,
        details.toColumnName,
        statusLabel,
        task.id,
      ),
  );
}

async function notifyTaskComment(
  task: TaskRow,
  commenter: AuthenticatedUser,
  message: string,
): Promise<void> {
  const preview = message.length > 120 ? `${message.slice(0, 117)}…` : message;
  const commenterName = displayName(commenter.firstName, commenter.lastName);
  const participantIds = (await getTaskParticipantIds(task)).filter((id) => id !== commenter.id);

  await createNotificationsForUsers(
    participantIds,
    NOTIFICATION_TYPES.TASK_COMMENT,
    'Nuevo comentario en tarea',
    `${task.title} — ${commenterName}: ${preview}`,
    NOTIFICATION_RESOURCE_TYPES.TASK,
    task.id,
  );

  await emailTaskParticipants(
    task,
    participantIds,
    'task-comment',
    (user) => () =>
      emailService.sendTaskComment(
        user.email,
        displayName(user.firstName, user.lastName),
        task.title,
        commenterName,
        preview,
        task.id,
      ),
  );
}

export async function notifyTaskDueSoon(task: TaskRow, assigneeId: number): Promise<void> {
  await createNotification(
    assigneeId,
    NOTIFICATION_TYPES.TASK_DUE_SOON,
    'Tarea próxima a vencer',
    `${task.title} vence en menos de 24 horas`,
    NOTIFICATION_RESOURCE_TYPES.TASK,
    task.id,
  );

  const assignee = await findUserById(assigneeId);
  if (assignee) {
    notifyEmail(
      () =>
        emailService.sendTaskDueSoon(
          assignee.email,
          displayName(assignee.firstName, assignee.lastName),
          task.title,
          task.dueDate?.toISOString() ?? '',
          task.id,
        ),
      `task-due-soon ${task.id}`,
    );
  }
}
