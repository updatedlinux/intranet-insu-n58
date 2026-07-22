import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DragDropContext, Draggable, Droppable, type DropResult } from '@hello-pangea/dnd';
import { ChevronDown, Plus, RefreshCw } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { ApiError } from '../../api/client';
import { fetchBoard, fetchMyBoards } from '../../api/boards';
import type { BoardColumn, BoardDetail, TaskCard as TaskCardType } from '../../api/boards.types';
import { moveTask } from '../../api/tasks';
import { fetchActiveTags } from '../../api/tags';
import { PageHeader } from '../../components/layout';
import { TaskCard } from '../../components/activities/TaskCard';
import { TaskCreateModal } from '../../components/activities/TaskCreateModal';
import { TaskDetailPanel } from '../../components/activities/TaskDetailPanel';
import { Select } from '../../components/ui/Select';
import '../../styles/activities.css';

function groupTasksByColumn(tasks: TaskCardType[], columns: BoardColumn[]) {
  const map = new Map<number, TaskCardType[]>();
  for (const col of columns) {
    map.set(col.id, []);
  }
  for (const task of tasks) {
    const list = map.get(task.columnId);
    if (list) list.push(task);
  }
  for (const [, list] of map) {
    list.sort((a, b) => a.order - b.order || a.id - b.id);
  }
  return map;
}

export function ActivitiesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [boards, setBoards] = useState<{ id: number; name: string; areaName: string }[]>([]);
  const [selectedBoardId, setSelectedBoardId] = useState<number | null>(null);
  const [boardDetail, setBoardDetail] = useState<BoardDetail | null>(null);
  const [tasks, setTasks] = useState<TaskCardType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [createColumnId, setCreateColumnId] = useState<number | null>(null);
  const [boardPickerOpen, setBoardPickerOpen] = useState(false);
  const [activeColumnIndex, setActiveColumnIndex] = useState(0);
  const [detailTaskId, setDetailTaskId] = useState<number | null>(null);
  const [tagOptions, setTagOptions] = useState<{ value: number; label: string }[]>([]);
  const boardRef = useRef<HTMLDivElement>(null);

  const taskParam = searchParams.get('task');

  useEffect(() => {
    if (taskParam) {
      const id = Number.parseInt(taskParam, 10);
      if (id > 0) setDetailTaskId(id);
    }
  }, [taskParam]);

  const openTask = (taskId: number) => {
    setDetailTaskId(taskId);
    setSearchParams({ task: String(taskId) });
  };

  const closeTask = () => {
    setDetailTaskId(null);
    setSearchParams({});
  };

  const loadBoards = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [boardsRes, tagsRes] = await Promise.all([fetchMyBoards(), fetchActiveTags()]);
      setBoards(boardsRes.items);
      setTagOptions(tagsRes.items.map((t) => ({ value: t.id, label: t.name })));
      if (boardsRes.items.length > 0) {
        setSelectedBoardId((prev) => prev ?? boardsRes.items[0]!.id);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudieron cargar los tableros');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadBoard = useCallback(async (boardId: number) => {
    setError('');
    try {
      const detail = await fetchBoard(boardId);
      setBoardDetail(detail);
      setTasks(detail.tasks);
      setActiveColumnIndex(0);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo cargar el tablero');
      setBoardDetail(null);
      setTasks([]);
    }
  }, []);

  useEffect(() => {
    void loadBoards();
  }, [loadBoards]);

  useEffect(() => {
    if (selectedBoardId) void loadBoard(selectedBoardId);
  }, [selectedBoardId, loadBoard]);

  useEffect(() => {
    const el = boardRef.current;
    if (!el) return;

    const onScroll = () => {
      const width = el.clientWidth;
      if (width <= 0) return;
      const index = Math.round(el.scrollLeft / width);
      setActiveColumnIndex(index);
    };

    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [boardDetail?.columns.length]);

  const columns = boardDetail?.columns ?? [];
  const tasksByColumn = useMemo(() => groupTasksByColumn(tasks, columns), [tasks, columns]);

  const handleRefresh = () => {
    if (selectedBoardId) void loadBoard(selectedBoardId);
  };

  const openCreate = (columnId?: number) => {
    setCreateColumnId(columnId ?? null);
    setCreateOpen(true);
  };

  const scrollToColumn = (index: number) => {
    const el = boardRef.current;
    if (!el) return;
    el.scrollTo({ left: index * el.clientWidth, behavior: 'smooth' });
    setActiveColumnIndex(index);
  };

  const handleDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) {
      return;
    }

    const taskId = Number.parseInt(draggableId, 10);
    const sourceColumnId = Number.parseInt(source.droppableId, 10);
    const destColumnId = Number.parseInt(destination.droppableId, 10);

    const sourceTasks = [...(tasksByColumn.get(sourceColumnId) ?? [])];
    const destTasks =
      sourceColumnId === destColumnId ? sourceTasks : [...(tasksByColumn.get(destColumnId) ?? [])];

    const [moved] = sourceTasks.splice(source.index, 1);
    if (!moved) return;

    if (sourceColumnId === destColumnId) {
      sourceTasks.splice(destination.index, 0, moved);
    } else {
      destTasks.splice(destination.index, 0, { ...moved, columnId: destColumnId });
    }

    const updatedTasks = tasks.map((t) => {
      if (t.id !== taskId) return t;
      return { ...t, columnId: destColumnId, order: destination.index };
    });
    setTasks(updatedTasks);

    const taskOrders = (sourceColumnId === destColumnId ? sourceTasks : destTasks).map(
      (t, order) => ({
        taskId: t.id,
        order,
      }),
    );

    try {
      await moveTask(taskId, {
        columnId: destColumnId,
        order: destination.index,
        taskOrders,
      });
      if (selectedBoardId) void loadBoard(selectedBoardId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo mover la tarea');
      if (selectedBoardId) void loadBoard(selectedBoardId);
    }
  };

  const renderColumn = (column: BoardColumn) => {
    const columnTasks = tasksByColumn.get(column.id) ?? [];
    return (
      <div key={column.id} className="kanban-column">
        <header
          className="kanban-column__header"
          style={column.color ? { borderTopColor: column.color } : undefined}
        >
          <h3>{column.name}</h3>
          <span className="kanban-column__count">{columnTasks.length}</span>
        </header>
        <Droppable droppableId={String(column.id)}>
          {(provided, snapshot) => (
            <div
              ref={provided.innerRef}
              {...provided.droppableProps}
              className={`kanban-column__body${snapshot.isDraggingOver ? ' is-drag-over' : ''}`}
            >
              {columnTasks.map((task, index) => (
                <Draggable key={task.id} draggableId={String(task.id)} index={index}>
                  {(dragProvided, dragSnapshot) => (
                    <div
                      ref={dragProvided.innerRef}
                      {...dragProvided.draggableProps}
                      {...dragProvided.dragHandleProps}
                      className={dragSnapshot.isDragging ? 'is-dragging' : ''}
                    >
                      <TaskCard task={task} onClick={() => openTask(task.id)} />
                    </div>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
        <button
          type="button"
          className="kanban-column__add-card"
          onClick={() => openCreate(column.id)}
        >
          <Plus size={16} aria-hidden />
          Añadir tarjeta
        </button>
      </div>
    );
  };

  return (
    <div className="kanban-page">
      <div className="kanban-page__header kanban-page__header--desktop">
        <PageHeader
          title="Gestión de Tareas"
          breadcrumbParent="Actividades"
          breadcrumbCurrent="Gestión de Tareas"
          breadcrumbParentHref="/actividades"
        />
      </div>

      {boardDetail && (
        <header className="kanban-mobile-header">
          <div className="kanban-mobile-header__info">
            {boards.length > 1 ? (
              <button
                type="button"
                className="kanban-mobile-header__title-btn"
                onClick={() => setBoardPickerOpen(true)}
                aria-expanded={boardPickerOpen}
              >
                <span className="kanban-mobile-header__title">{boardDetail.board.name}</span>
                <ChevronDown size={18} aria-hidden />
              </button>
            ) : (
              <h1 className="kanban-mobile-header__title">{boardDetail.board.name}</h1>
            )}
            <p className="kanban-mobile-header__subtitle">{boardDetail.board.areaName}</p>
          </div>
          <button
            type="button"
            className="kanban-mobile-header__refresh"
            onClick={handleRefresh}
            aria-label="Actualizar tablero"
          >
            <RefreshCw size={18} aria-hidden />
          </button>
        </header>
      )}

      <div className="kanban-page__board-surface">
        <div className="kanban-toolbar kanban-toolbar--embedded">
          <div className="kanban-toolbar__left">
            {boards.length > 1 && (
              <label className="kanban-board-select">
                <span className="sr-only">Tablero</span>
                <Select
                  value={selectedBoardId != null ? String(selectedBoardId) : ''}
                  onChange={(v) => setSelectedBoardId(Number.parseInt(v, 10))}
                  options={boards.map((b) => ({
                    value: String(b.id),
                    label: b.name,
                  }))}
                />
              </label>
            )}
            {boards.length === 1 && boardDetail && (
              <span className="kanban-board-name">{boardDetail.board.name}</span>
            )}
            {boardDetail && boards.length > 1 && (
              <span className="kanban-board-area">{boardDetail.board.areaName}</span>
            )}
          </div>

          <div className="kanban-toolbar__actions">
            <button
              type="button"
              className="kanban-toolbar__icon-btn"
              onClick={handleRefresh}
              aria-label="Actualizar"
            >
              <RefreshCw size={18} aria-hidden />
            </button>
            {selectedBoardId && (
              <button
                type="button"
                className="kanban-toolbar__primary-btn"
                onClick={() => openCreate()}
              >
                <Plus size={16} aria-hidden />
                Nueva tarea
              </button>
            )}
          </div>
        </div>

        {error && <div className="kanban-page__error">{error}</div>}

        {loading && !boardDetail ? (
          <p className="kanban-page__loading">Cargando tablero…</p>
        ) : boards.length === 0 ? (
          <div className="kanban-page__empty">
            <p>No hay tableros disponibles para su área.</p>
          </div>
        ) : (
          <DragDropContext onDragEnd={(result) => void handleDragEnd(result)}>
            <div ref={boardRef} className="kanban-board">
              {columns.map((column) => renderColumn(column))}
            </div>
            {columns.length > 1 && (
              <nav className="kanban-mobile-dots" aria-label="Columnas del tablero">
                {columns.map((column, index) => (
                  <button
                    key={column.id}
                    type="button"
                    className={`kanban-mobile-dots__dot${index === activeColumnIndex ? ' is-active' : ''}`}
                    onClick={() => scrollToColumn(index)}
                    aria-label={`Ir a ${column.name}`}
                    aria-current={index === activeColumnIndex ? 'true' : undefined}
                  />
                ))}
              </nav>
            )}
          </DragDropContext>
        )}
      </div>

      {selectedBoardId && boardDetail && (
        <button
          type="button"
          className="kanban-mobile-fab"
          onClick={() => openCreate(columns[activeColumnIndex]?.id)}
          aria-label="Nueva tarea"
        >
          <Plus size={24} aria-hidden />
        </button>
      )}

      {boardPickerOpen && (
        <div
          className="kanban-board-picker"
          role="presentation"
          onClick={() => setBoardPickerOpen(false)}
        >
          <div
            className="kanban-board-picker__sheet"
            role="dialog"
            aria-label="Seleccionar tablero"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="kanban-board-picker__title">Tableros</h3>
            <ul className="kanban-board-picker__list">
              {boards.map((b) => (
                <li key={b.id}>
                  <button
                    type="button"
                    className={`kanban-board-picker__item${b.id === selectedBoardId ? ' is-active' : ''}`}
                    onClick={() => {
                      setSelectedBoardId(b.id);
                      setBoardPickerOpen(false);
                    }}
                  >
                    <span className="kanban-board-picker__item-name">{b.name}</span>
                    <span className="kanban-board-picker__item-area">{b.areaName}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {selectedBoardId && boardDetail && (
        <TaskCreateModal
          open={createOpen}
          boardId={selectedBoardId}
          columns={columns}
          assignableUsers={boardDetail.assignableUsers}
          tagOptions={tagOptions}
          defaultColumnId={createColumnId}
          onClose={() => {
            setCreateOpen(false);
            setCreateColumnId(null);
          }}
          onCreated={handleRefresh}
        />
      )}

      {detailTaskId && boardDetail && (
        <TaskDetailPanel
          taskId={detailTaskId}
          assignableUsers={boardDetail.assignableUsers}
          tagOptions={tagOptions}
          canManage={boardDetail.capabilities.canManage}
          onClose={closeTask}
          onUpdated={handleRefresh}
        />
      )}
    </div>
  );
}
