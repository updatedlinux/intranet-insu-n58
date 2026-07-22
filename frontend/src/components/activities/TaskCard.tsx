import { Paperclip, Calendar } from 'lucide-react';
import type { TaskCard as TaskCardType } from '../../api/boards.types';
import { UserAvatar } from '../admin/UserAvatar';
import { TaskPriorityBadge } from './TaskPriorityBadge';

interface TaskCardProps {
  task: TaskCardType;
  onClick: () => void;
}

function formatDueDate(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
}

function isOverdue(dueDate: string | null, status: string): boolean {
  if (!dueDate || status === 'DONE') return false;
  return new Date(dueDate) < new Date();
}

export function TaskCard({ task, onClick }: TaskCardProps) {
  const borderColor = task.color ?? '#64748b';
  const overdue = isOverdue(task.dueDate, task.status);

  return (
    <div
      className="kanban-card"
      style={{ borderLeftColor: borderColor }}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      role="button"
      tabIndex={0}
    >
      <span className="kanban-card__check" aria-hidden />
      <div className="kanban-card__inner">
        <div className="kanban-card__header">
          <TaskPriorityBadge priority={task.priority} label={task.priorityLabel} />
          {task.attachmentCount > 0 && (
            <span className="kanban-card__attach" title={`${task.attachmentCount} adjunto(s)`}>
              <Paperclip size={14} aria-hidden />
              {task.attachmentCount}
            </span>
          )}
        </div>
        <h4 className="kanban-card__title">{task.title}</h4>
        {task.tags.length > 0 && (
          <div className="kanban-card__tags">
            {task.tags.map((tag) => (
              <span key={tag.tagId} className="kanban-card__tag">
                {tag.tagName}
              </span>
            ))}
          </div>
        )}
        <div className="kanban-card__footer">
          {task.dueDate && (
            <span className={`kanban-card__due${overdue ? ' is-overdue' : ''}`}>
              <Calendar size={13} aria-hidden />
              {formatDueDate(task.dueDate)}
            </span>
          )}
          {task.assignees.length > 0 && (
            <div className="kanban-card__avatars">
              {task.assignees.slice(0, 3).map((a) => (
                <UserAvatar
                  key={a.userId}
                  userId={a.userId}
                  firstName={a.firstName}
                  lastName={a.lastName}
                  size="sm"
                />
              ))}
              {task.assignees.length > 3 && (
                <span className="kanban-card__more">+{task.assignees.length - 3}</span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
