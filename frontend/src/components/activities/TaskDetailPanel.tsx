import { useCallback, useEffect, useState } from 'react';
import { Archive, Paperclip, Send, X } from 'lucide-react';
import type { AssignableUser, TaskPriority } from '../../api/boards.types';
import type { TaskActivity, TaskAttachment, TaskComment, TaskDetail } from '../../api/tasks.types';
import {
  addTaskComment,
  archiveTask,
  assignTask,
  deleteTaskAttachment,
  fetchTask,
  updateTask,
  uploadTaskAttachment,
} from '../../api/tasks';
import { MultiSelect, type MultiSelectOption } from '../ui/MultiSelect';
import { Select } from '../ui/Select';
import { TaskAttachmentList } from './TaskAttachmentList';
import { TaskPriorityBadge } from './TaskPriorityBadge';
import { formatDateTime } from '../../utils/relative-time';

const PRIORITIES: TaskPriority[] = ['Low', 'Medium', 'High', 'Critical'];

const ACTION_LABELS: Record<string, string> = {
  CREATED: 'Creó la tarea',
  MOVED: 'Movió la tarea',
  ASSIGNED: 'Actualizó asignados',
  COMMENTED: 'Comentó',
  ATTACHMENT_ADDED: 'Agregó adjunto',
  STATUS_CHANGED: 'Cambió estado',
  ARCHIVED: 'Archivó la tarea',
  UPDATED: 'Actualizó la tarea',
};

interface TaskDetailPanelProps {
  taskId: number | null;
  assignableUsers: AssignableUser[];
  tagOptions: MultiSelectOption[];
  canManage: boolean;
  onClose: () => void;
  onUpdated: () => void;
}

export function TaskDetailPanel({
  taskId,
  assignableUsers,
  tagOptions,
  canManage,
  onClose,
  onUpdated,
}: TaskDetailPanelProps) {
  const [item, setItem] = useState<TaskDetail | null>(null);
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [attachments, setAttachments] = useState<TaskAttachment[]>([]);
  const [activity, setActivity] = useState<TaskActivity[]>([]);
  const [loading, setLoading] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!taskId) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetchTask(taskId);
      setItem(res.item);
      setComments(res.comments);
      setAttachments(res.attachments);
      setActivity(res.activity);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar la tarea');
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!taskId) return null;

  const userOptions: MultiSelectOption[] = assignableUsers.map((u) => ({
    value: u.id,
    label: `${u.firstName} ${u.lastName}`,
  }));

  const assigneeIds = item?.assignees.map((a) => a.userId) ?? [];
  const tagIds = item?.tags.map((t) => t.tagId) ?? [];

  const handleFieldUpdate = async (data: Parameters<typeof updateTask>[1]) => {
    if (!taskId) return;
    setSaving(true);
    try {
      const res = await updateTask(taskId, data);
      setItem(res.item);
      onUpdated();
      void load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleAssigneesChange = async (newIds: number[]) => {
    if (!taskId || !item) return;
    const addIds = newIds.filter((id) => !assigneeIds.includes(id));
    const removeIds = assigneeIds.filter((id) => !newIds.includes(id));
    if (addIds.length === 0 && removeIds.length === 0) return;
    setSaving(true);
    try {
      const res = await assignTask(taskId, addIds, removeIds);
      setItem(res.item);
      onUpdated();
      void load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al asignar');
    } finally {
      setSaving(false);
    }
  };

  const handleComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim() || !taskId) return;
    setSaving(true);
    try {
      await addTaskComment(taskId, commentText.trim());
      setCommentText('');
      void load();
      onUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al comentar');
    } finally {
      setSaving(false);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !taskId) return;
    setSaving(true);
    try {
      await uploadTaskAttachment(taskId, file);
      void load();
      onUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al subir archivo');
    } finally {
      setSaving(false);
      e.target.value = '';
    }
  };

  const handleDeleteAttachment = async (attachmentId: number) => {
    if (!taskId || !window.confirm('¿Eliminar este adjunto?')) return;
    try {
      await deleteTaskAttachment(taskId, attachmentId);
      void load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al eliminar');
    }
  };

  const handleArchive = async () => {
    if (!taskId || !window.confirm('¿Archivar esta tarea?')) return;
    try {
      await archiveTask(taskId);
      onUpdated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al archivar');
    }
  };

  return (
    <div className="kanban-panel-overlay" onClick={onClose} role="presentation">
      <aside
        className="kanban-panel card-style"
        onClick={(e) => e.stopPropagation()}
        aria-label="Detalle de tarea"
      >
        <div className="kanban-panel__header">
          <h2>Detalle de tarea</h2>
          <button
            type="button"
            className="kanban-modal__close"
            onClick={onClose}
            aria-label="Cerrar"
          >
            <X size={20} />
          </button>
        </div>

        {loading && !item ? (
          <p className="p-20 text-gray">Cargando…</p>
        ) : item ? (
          <div className="kanban-panel__body">
            {error && <div className="admin-alert admin-alert--error mb-16">{error}</div>}

            <input
              className="kanban-panel__title-input"
              value={item.title}
              onChange={(e) => setItem({ ...item, title: e.target.value })}
              onBlur={() => {
                if (item.title.trim()) void handleFieldUpdate({ title: item.title.trim() });
              }}
              disabled={!!item.archivedAt || saving}
            />

            <div className="kanban-panel__meta">
              <TaskPriorityBadge priority={item.priority} label={item.priorityLabel} />
              <span className="text-gray">{item.statusLabel}</span>
            </div>

            <label className="admin-form__label">
              Descripción
              <textarea
                className="admin-form__input"
                rows={4}
                value={item.description ?? ''}
                onChange={(e) => setItem({ ...item, description: e.target.value })}
                onBlur={() => void handleFieldUpdate({ description: item.description })}
                disabled={!!item.archivedAt || saving}
              />
            </label>

            <div className="kanban-form-row">
              <label className="admin-form__label">
                Prioridad
                <Select
                  value={item.priority}
                  onChange={(v) => {
                    const priority = v as TaskPriority;
                    setItem({ ...item, priority });
                    void handleFieldUpdate({ priority });
                  }}
                  disabled={!!item.archivedAt || saving}
                  options={PRIORITIES.map((p) => ({ value: p, label: p }))}
                />
              </label>

              <label className="admin-form__label">
                Fecha límite
                <input
                  type="datetime-local"
                  className="admin-form__input"
                  value={item.dueDate ? item.dueDate.slice(0, 16) : ''}
                  onChange={(e) => {
                    const dueDate = e.target.value ? new Date(e.target.value).toISOString() : null;
                    setItem({ ...item, dueDate });
                    void handleFieldUpdate({ dueDate });
                  }}
                  disabled={!!item.archivedAt || saving}
                />
              </label>
            </div>

            <div className="admin-form__field">
              <span className="admin-form__label">Asignados</span>
              <MultiSelect
                options={userOptions}
                value={assigneeIds}
                onChange={(ids) => void handleAssigneesChange(ids)}
                disabled={!!item.archivedAt || saving}
              />
            </div>

            {tagOptions.length > 0 && (
              <div className="admin-form__field">
                <span className="admin-form__label">Etiquetas</span>
                <MultiSelect
                  options={tagOptions}
                  value={tagIds}
                  onChange={(ids) => void handleFieldUpdate({ tagIds: ids })}
                  disabled={!!item.archivedAt || saving}
                />
              </div>
            )}

            <section className="kanban-panel__section">
              <h3>
                <Paperclip size={16} aria-hidden /> Adjuntos
              </h3>
              <TaskAttachmentList
                taskId={taskId}
                attachments={attachments}
                canDelete={!item.archivedAt}
                onDelete={(attachmentId) => void handleDeleteAttachment(attachmentId)}
                onError={setError}
              />
              {!item.archivedAt && (
                <label className="admin-btn admin-btn--ghost admin-btn--sm">
                  Subir archivo
                  <input type="file" hidden onChange={(e) => void handleUpload(e)} />
                </label>
              )}
            </section>

            <section className="kanban-panel__section">
              <h3>Comentarios</h3>
              <ul className="kanban-comments">
                {comments.map((c) => (
                  <li key={c.id} className={c.isOwn ? 'is-own' : ''}>
                    <div className="kanban-comment__meta">
                      <strong>{c.authorName}</strong>
                      <span>{formatDateTime(c.createdAt)}</span>
                    </div>
                    <p>{c.message}</p>
                  </li>
                ))}
              </ul>
              {!item.archivedAt && (
                <form onSubmit={(e) => void handleComment(e)} className="kanban-comment-form">
                  <textarea
                    className="admin-form__input"
                    rows={2}
                    placeholder="Escriba un comentario…"
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                  />
                  <button
                    type="submit"
                    className="admin-btn admin-btn--primary admin-btn--sm"
                    disabled={!commentText.trim() || saving}
                  >
                    <Send size={14} aria-hidden />
                    Enviar
                  </button>
                </form>
              )}
            </section>

            <section className="kanban-panel__section">
              <h3>Actividad</h3>
              <ul className="kanban-activity">
                {activity.map((a) => (
                  <li key={a.id}>
                    <strong>{a.authorName}</strong> {ACTION_LABELS[a.action] ?? a.action}
                    <time>{formatDateTime(a.createdAt)}</time>
                  </li>
                ))}
              </ul>
            </section>

            {canManage && !item.archivedAt && (
              <button
                type="button"
                className="admin-btn admin-btn--ghost kanban-archive-btn"
                onClick={() => void handleArchive()}
              >
                <Archive size={16} aria-hidden />
                Archivar tarea
              </button>
            )}
          </div>
        ) : (
          <p className="p-20 text-gray">Tarea no encontrada</p>
        )}
      </aside>
    </div>
  );
}
