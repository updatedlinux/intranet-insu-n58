import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import type { AssignableUser, BoardColumn, TaskPriority } from '../../api/boards.types';
import { createTask } from '../../api/tasks';
import { MultiSelect, type MultiSelectOption } from '../ui/MultiSelect';
import { Select } from '../ui/Select';

const PRIORITIES: { value: TaskPriority; label: string }[] = [
  { value: 'Low', label: 'Baja' },
  { value: 'Medium', label: 'Media' },
  { value: 'High', label: 'Alta' },
  { value: 'Critical', label: 'Crítica' },
];

const COLORS = ['#64748b', '#0369a1', '#b45309', '#15803d', '#7c3aed', '#be123c'];

interface TaskCreateModalProps {
  open: boolean;
  boardId: number;
  columns: BoardColumn[];
  assignableUsers: AssignableUser[];
  tagOptions: MultiSelectOption[];
  defaultColumnId?: number | null;
  onClose: () => void;
  onCreated: () => void;
}

export function TaskCreateModal({
  open,
  boardId,
  columns,
  assignableUsers,
  tagOptions,
  defaultColumnId = null,
  onClose,
  onCreated,
}: TaskCreateModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('Medium');
  const [color, setColor] = useState<string | null>('#64748b');
  const [dueDate, setDueDate] = useState('');
  const [columnId, setColumnId] = useState(columns[0]?.id ?? 0);
  const [assigneeIds, setAssigneeIds] = useState<number[]>([]);
  const [tagIds, setTagIds] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    const fallback = columns[0]?.id ?? 0;
    setColumnId(defaultColumnId ?? fallback);
  }, [open, columns, defaultColumnId]);

  if (!open) return null;

  const userOptions: MultiSelectOption[] = assignableUsers.map((u) => ({
    value: u.id,
    label: `${u.firstName} ${u.lastName} (${u.areaName})`,
  }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !columnId) return;
    setSaving(true);
    setError('');
    try {
      await createTask({
        boardId,
        columnId,
        title: title.trim(),
        description: description.trim() || null,
        priority,
        color,
        dueDate: dueDate ? new Date(dueDate).toISOString() : null,
        assigneeIds,
        tagIds,
      });
      setTitle('');
      setDescription('');
      setPriority('Medium');
      setColor('#64748b');
      setDueDate('');
      setAssigneeIds([]);
      setTagIds([]);
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear la tarea');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="kanban-modal-overlay" onClick={onClose} role="presentation">
      <div
        className="kanban-modal card-style"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="task-create-title"
      >
        <div className="kanban-modal__header">
          <h2 id="task-create-title">Nueva tarea</h2>
          <button
            type="button"
            className="kanban-modal__close"
            onClick={onClose}
            aria-label="Cerrar"
          >
            <X size={20} />
          </button>
        </div>
        <form onSubmit={(e) => void handleSubmit(e)} className="kanban-modal__body">
          {error && <div className="admin-alert admin-alert--error mb-16">{error}</div>}

          <label className="admin-form__label">
            Título *
            <input
              className="admin-form__input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              maxLength={300}
            />
          </label>

          <label className="admin-form__label">
            Descripción
            <textarea
              className="admin-form__input"
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>

          <div className="kanban-form-row">
            <label className="admin-form__label">
              Prioridad
              <Select
                value={priority}
                onChange={(v) => setPriority(v as TaskPriority)}
                options={PRIORITIES.map((p) => ({ value: p.value, label: p.label }))}
              />
            </label>

            <label className="admin-form__label">
              Columna inicial
              <Select
                value={String(columnId)}
                onChange={(v) => setColumnId(Number.parseInt(v, 10))}
                options={columns.map((c) => ({ value: String(c.id), label: c.name }))}
              />
            </label>
          </div>

          <label className="admin-form__label">
            Fecha límite
            <input
              type="datetime-local"
              className="admin-form__input"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </label>

          <fieldset className="kanban-color-picker">
            <legend className="admin-form__label">Color de tarjeta</legend>
            <div className="kanban-color-picker__options">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`kanban-color-swatch${color === c ? ' is-selected' : ''}`}
                  style={{ background: c }}
                  onClick={() => setColor(c)}
                  aria-label={`Color ${c}`}
                />
              ))}
            </div>
          </fieldset>

          <div className="admin-form__field">
            <span className="admin-form__label">Asignados</span>
            <MultiSelect
              options={userOptions}
              value={assigneeIds}
              onChange={setAssigneeIds}
              placeholder="Seleccionar colaboradores…"
            />
          </div>

          <div className="admin-form__field">
            <span className="admin-form__label">Etiquetas</span>
            <MultiSelect
              options={tagOptions}
              value={tagIds}
              onChange={setTagIds}
              placeholder={
                tagOptions.length > 0 ? 'Seleccionar etiquetas…' : 'No hay etiquetas disponibles'
              }
              disabled={tagOptions.length === 0}
            />
          </div>

          <div className="kanban-modal__actions">
            <button type="button" className="admin-btn admin-btn--ghost" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="admin-btn admin-btn--primary" disabled={saving}>
              {saving ? 'Creando…' : 'Crear tarea'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
