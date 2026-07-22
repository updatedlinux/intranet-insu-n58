import type { TaskPriority } from '../../api/boards.types';

const STYLES: Record<TaskPriority, { bg: string; color: string; label: string }> = {
  Low: { bg: '#f1f5f9', color: '#475569', label: 'Baja' },
  Medium: { bg: '#dbeafe', color: '#1d4ed8', label: 'Media' },
  High: { bg: '#ffedd5', color: '#c2410c', label: 'Alta' },
  Critical: { bg: '#fee2e2', color: '#b91c1c', label: 'Crítica' },
};

interface TaskPriorityBadgeProps {
  priority: TaskPriority;
  label?: string;
  className?: string;
}

export function TaskPriorityBadge({ priority, label, className = '' }: TaskPriorityBadgeProps) {
  const style = STYLES[priority];
  return (
    <span
      className={`task-priority-badge ${className}`.trim()}
      style={{ background: style.bg, color: style.color }}
    >
      {label ?? style.label}
    </span>
  );
}
