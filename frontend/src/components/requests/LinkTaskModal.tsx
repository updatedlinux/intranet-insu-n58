import { useCallback, useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { ApiError } from '../../api/client';
import { fetchBoard, fetchMyBoards } from '../../api/boards';
import type { TaskCard } from '../../api/boards.types';
import { linkRequestTask } from '../../api/requests';

interface LinkTaskModalProps {
  open: boolean;
  requestId: number;
  targetAreaId: number;
  onClose: () => void;
  onLinked: () => void;
}

export function LinkTaskModal({
  open,
  requestId,
  targetAreaId,
  onClose,
  onLinked,
}: LinkTaskModalProps) {
  const [tasks, setTasks] = useState<TaskCard[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [linking, setLinking] = useState<number | null>(null);
  const [error, setError] = useState('');

  const loadTasks = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const boards = await fetchMyBoards();
      const board = boards.items.find((b) => b.areaId === targetAreaId);
      if (!board) {
        setTasks([]);
        setError('No tiene acceso al tablero del área destino');
        return;
      }
      const detail = await fetchBoard(board.id);
      setTasks(detail.tasks.filter((t) => t.status !== 'ARCHIVED'));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudieron cargar las tareas');
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, [targetAreaId]);

  useEffect(() => {
    if (open) void loadTasks();
  }, [open, loadTasks]);

  if (!open) return null;

  const filtered = tasks.filter((t) => t.title.toLowerCase().includes(search.trim().toLowerCase()));

  async function handleLink(taskId: number) {
    setLinking(taskId);
    setError('');
    try {
      await linkRequestTask(requestId, taskId);
      onLinked();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo vincular la tarea');
    } finally {
      setLinking(null);
    }
  }

  return (
    <div className="admin-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="admin-modal card-style"
        role="dialog"
        aria-labelledby="link-task-title"
        onClick={(ev) => ev.stopPropagation()}
      >
        <div className="admin-modal__header">
          <h2 id="link-task-title" className="admin-modal__title">
            Vincular a tarea
          </h2>
          <button
            type="button"
            className="admin-modal__close"
            onClick={onClose}
            aria-label="Cerrar"
          >
            <X size={20} />
          </button>
        </div>

        <input
          type="search"
          className="admin-form__input mb-20"
          placeholder="Buscar tarea por título…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        {error && <div className="admin-alert admin-alert--error mb-20">{error}</div>}

        {loading ? (
          <p className="text-gray p-20">Cargando tareas…</p>
        ) : filtered.length === 0 ? (
          <p className="text-gray p-20">No hay tareas disponibles en el tablero del área.</p>
        ) : (
          <ul className="req-task-picker">
            {filtered.map((task) => (
              <li key={task.id}>
                <button
                  type="button"
                  className="req-task-picker__item"
                  disabled={linking != null}
                  onClick={() => void handleLink(task.id)}
                >
                  <span className="req-task-picker__title">{task.title}</span>
                  <span className="req-task-picker__meta">{task.statusLabel}</span>
                  {linking === task.id && (
                    <span className="req-task-picker__loading">Vinculando…</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
