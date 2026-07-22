import type { TicketPriority, TicketStatus } from '../../api/tickets.types';

export function TicketStatusBadge({ status, label }: { status: TicketStatus; label: string }) {
  const key = status.toLowerCase();
  return <span className={`sd-badge sd-badge--${key}`}>{label}</span>;
}

export function TicketPriorityBadge({
  priority,
  label,
}: {
  priority: TicketPriority;
  label: string;
}) {
  const key = priority.toLowerCase();
  return <span className={`sd-badge sd-badge--${key}`}>{label}</span>;
}
