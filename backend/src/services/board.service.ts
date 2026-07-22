import type { AppError } from '../middlewares/error.middleware';
import { TASK_PRIORITY_LABELS } from '../constants/task-priority';
import { TASK_STATUS_LABELS } from '../constants/task-status';
import {
  canAccessBoard,
  canManageBoard,
  getAccessibleBoardAreaIds,
  getAssignableAreaIdsForBoard,
} from '../policies/board-access.policy';
import { isSystemAdmin } from '../policies/document-access.policy';
import {
  countTasksInColumn,
  deleteBoardColumn,
  findBoardById,
  findColumnById,
  getMaxColumnOrder,
  insertBoardColumn,
  listAllBoards,
  listBoardsByAreaIds,
  listColumnsByBoardId,
  reorderBoardColumns,
  updateBoardColumn,
} from '../repositories/board.repository';
import {
  getBoardMetrics,
  listTaskAssignees,
  listTaskTags,
  listTasksByBoardId,
  listUsersByAreaIds,
  type TaskRow,
} from '../repositories/task.repository';
import type { AuthenticatedUser } from '../types/auth';
import type { TaskStatus } from '../constants/task-status';

function notFound(message = 'Tablero no encontrado'): AppError {
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

export interface PublicBoardSummary {
  id: number;
  areaId: number;
  areaName: string;
  name: string;
  createdAt: string;
}

export interface PublicBoardColumn {
  id: number;
  boardId: number;
  name: string;
  order: number;
  color: string | null;
  defaultStatus: string;
}

export interface PublicTaskCard {
  id: number;
  boardId: number;
  columnId: number;
  title: string;
  description: string | null;
  priority: string;
  priorityLabel: string;
  status: string;
  statusLabel: string;
  color: string | null;
  dueDate: string | null;
  createdBy: number;
  creatorName: string;
  createdAt: string;
  updatedAt: string;
  order: number;
  attachmentCount: number;
  assignees: { userId: number; firstName: string; lastName: string; areaName: string }[];
  tags: { tagId: number; tagName: string }[];
}

export interface PublicBoardDetail {
  board: PublicBoardSummary;
  columns: PublicBoardColumn[];
  tasks: PublicTaskCard[];
  assignableUsers: {
    id: number;
    firstName: string;
    lastName: string;
    areaId: number;
    areaName: string;
  }[];
  capabilities: { canManage: boolean; canViewMetrics: boolean };
}

function toBoardSummary(row: {
  id: number;
  areaId: number;
  areaName: string;
  name: string;
  createdAt: Date;
}): PublicBoardSummary {
  return {
    id: row.id,
    areaId: row.areaId,
    areaName: row.areaName,
    name: row.name,
    createdAt: row.createdAt.toISOString(),
  };
}

async function enrichTaskCards(tasks: TaskRow[]): Promise<PublicTaskCard[]> {
  return Promise.all(
    tasks.map(async (task) => {
      const [assignees, tags] = await Promise.all([
        listTaskAssignees(task.id),
        listTaskTags(task.id),
      ]);
      return {
        id: task.id,
        boardId: task.boardId,
        columnId: task.columnId,
        title: task.title,
        description: task.description,
        priority: task.priority,
        priorityLabel: TASK_PRIORITY_LABELS[task.priority],
        status: task.status,
        statusLabel: TASK_STATUS_LABELS[task.status],
        color: task.color,
        dueDate: task.dueDate?.toISOString() ?? null,
        createdBy: task.createdBy,
        creatorName: `${task.creatorFirstName} ${task.creatorLastName}`.trim(),
        createdAt: task.createdAt.toISOString(),
        updatedAt: task.updatedAt.toISOString(),
        order: task.order,
        attachmentCount: task.attachmentCount,
        assignees,
        tags,
      };
    }),
  );
}

export async function listMyBoardsService(
  user: AuthenticatedUser,
): Promise<{ items: PublicBoardSummary[] }> {
  let boards;
  if (isSystemAdmin(user)) {
    boards = await listAllBoards();
  } else {
    const areaIds = await getAccessibleBoardAreaIds(user);
    boards = await listBoardsByAreaIds(areaIds);
  }
  return { items: boards.map(toBoardSummary) };
}

export async function getBoardDetailService(
  user: AuthenticatedUser,
  boardId: number,
): Promise<PublicBoardDetail> {
  const board = await findBoardById(boardId);
  if (!board) throw notFound();
  if (!(await canAccessBoard(user, board))) throw forbidden('No tiene acceso a este tablero');

  const [columns, tasks] = await Promise.all([
    listColumnsByBoardId(boardId),
    listTasksByBoardId(boardId),
  ]);

  const assignableAreaIds = await getAssignableAreaIdsForBoard(user, board.areaId);
  const assignableUsers = await listUsersByAreaIds(assignableAreaIds);
  const canManage = await canManageBoard(user, board);

  return {
    board: toBoardSummary(board),
    columns: columns.map((c) => ({
      id: c.id,
      boardId: c.boardId,
      name: c.name,
      order: c.order,
      color: c.color,
      defaultStatus: c.defaultStatus,
    })),
    tasks: await enrichTaskCards(tasks),
    assignableUsers,
    capabilities: {
      canManage,
      canViewMetrics: canManage,
    },
  };
}

export async function createBoardColumnService(
  user: AuthenticatedUser,
  boardId: number,
  data: { name: string; color: string | null; defaultStatus: TaskStatus },
): Promise<PublicBoardColumn> {
  const board = await findBoardById(boardId);
  if (!board) throw notFound();
  if (!(await canManageBoard(user, board))) {
    throw forbidden('Solo líderes o administradores pueden crear columnas');
  }

  const maxOrder = await getMaxColumnOrder(boardId);
  const id = await insertBoardColumn(
    boardId,
    data.name,
    maxOrder + 1,
    data.color,
    data.defaultStatus,
  );
  const column = await findColumnById(id);
  if (!column) throw notFound();

  return {
    id: column.id,
    boardId: column.boardId,
    name: column.name,
    order: column.order,
    color: column.color,
    defaultStatus: column.defaultStatus,
  };
}

export async function updateBoardColumnService(
  user: AuthenticatedUser,
  boardId: number,
  columnId: number,
  data: { name?: string; color?: string | null },
): Promise<PublicBoardColumn> {
  const board = await findBoardById(boardId);
  if (!board) throw notFound();
  if (!(await canManageBoard(user, board))) {
    throw forbidden('Solo líderes o administradores pueden editar columnas');
  }

  const column = await findColumnById(columnId);
  if (!column || column.boardId !== boardId) throw notFound('Columna no encontrada');

  await updateBoardColumn(columnId, data);
  const updated = await findColumnById(columnId);
  if (!updated) throw notFound();

  return {
    id: updated.id,
    boardId: updated.boardId,
    name: updated.name,
    order: updated.order,
    color: updated.color,
    defaultStatus: updated.defaultStatus,
  };
}

export async function reorderBoardColumnsService(
  user: AuthenticatedUser,
  boardId: number,
  columnOrders: { columnId: number; order: number }[],
): Promise<void> {
  const board = await findBoardById(boardId);
  if (!board) throw notFound();
  if (!(await canManageBoard(user, board))) {
    throw forbidden('Solo líderes o administradores pueden reordenar columnas');
  }

  const columns = await listColumnsByBoardId(boardId);
  const columnIds = new Set(columns.map((c) => c.id));
  for (const item of columnOrders) {
    if (!columnIds.has(item.columnId)) throw badRequest('Columna inválida');
  }

  await reorderBoardColumns(boardId, columnOrders);
}

export async function deleteBoardColumnService(
  user: AuthenticatedUser,
  boardId: number,
  columnId: number,
): Promise<void> {
  const board = await findBoardById(boardId);
  if (!board) throw notFound();
  if (!(await canManageBoard(user, board))) {
    throw forbidden('Solo líderes o administradores pueden eliminar columnas');
  }

  const column = await findColumnById(columnId);
  if (!column || column.boardId !== boardId) throw notFound('Columna no encontrada');

  const taskCount = await countTasksInColumn(columnId);
  if (taskCount > 0) throw badRequest('Solo puede eliminar columnas vacías');

  await deleteBoardColumn(columnId);
}

export async function getBoardMetricsService(user: AuthenticatedUser, boardId: number) {
  const board = await findBoardById(boardId);
  if (!board) throw notFound();
  if (!(await canManageBoard(user, board))) {
    throw forbidden('Solo líderes o administradores pueden ver métricas');
  }

  const metrics = await getBoardMetrics(boardId);
  const allTasks = await listTasksByBoardId(boardId);

  const totalTasks = allTasks.length;
  const inProgress = allTasks.filter(
    (t) => t.status === 'IN_PROGRESS' || t.status === 'IN_REVIEW',
  ).length;
  const completed = allTasks.filter((t) => t.status === 'DONE').length;
  const overdue = metrics.overdueTasks.length;

  return {
    summary: { totalTasks, completed, inProgress, overdue },
    byColumn: metrics.byColumn,
    byAssignee: metrics.byAssignee,
    overdueTasks: metrics.overdueTasks.map((t) => ({
      id: t.id,
      title: t.title,
      dueDate: t.dueDate?.toISOString() ?? null,
      priority: t.priority,
      priorityLabel: TASK_PRIORITY_LABELS[t.priority],
      columnId: t.columnId,
    })),
    completedLast30Days: metrics.completedLast30Days,
    avgCompletionHours:
      metrics.avgCompletionHours != null ? Math.round(metrics.avgCompletionHours * 10) / 10 : null,
  };
}
