import { apiRequest } from './client';
import type { BoardColumn, BoardDetail, BoardMetrics, BoardSummary } from './boards.types';

export function fetchMyBoards() {
  return apiRequest<{ items: BoardSummary[] }>('/boards/my');
}

export function fetchBoard(boardId: number) {
  return apiRequest<BoardDetail>(`/boards/${boardId}`);
}

export function fetchBoardMetrics(boardId: number) {
  return apiRequest<BoardMetrics>(`/boards/${boardId}/metrics`);
}

export function createBoardColumn(
  boardId: number,
  data: { name: string; color?: string | null; defaultStatus?: string },
) {
  return apiRequest<{ item: BoardColumn }>(`/boards/${boardId}/columns`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updateBoardColumn(
  boardId: number,
  columnId: number,
  data: { name?: string; color?: string | null },
) {
  return apiRequest<{ item: BoardColumn }>(`/boards/${boardId}/columns/${columnId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export function reorderBoardColumns(
  boardId: number,
  columns: { columnId: number; order: number }[],
) {
  return apiRequest<{ ok: boolean }>(`/boards/${boardId}/columns/reorder`, {
    method: 'PATCH',
    body: JSON.stringify({ columns }),
  });
}

export function deleteBoardColumn(boardId: number, columnId: number) {
  return apiRequest<void>(`/boards/${boardId}/columns/${columnId}`, {
    method: 'DELETE',
  });
}
