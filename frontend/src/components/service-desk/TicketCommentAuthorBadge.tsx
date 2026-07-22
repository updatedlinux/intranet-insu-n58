import type { TicketCommentAuthorRole } from '../../api/tickets.types';
import { getTicketCommentAuthorLabel } from '../../utils/ticket-comment';

interface TicketCommentAuthorBadgeProps {
  role: TicketCommentAuthorRole;
  inverted?: boolean;
}

export function TicketCommentAuthorBadge({
  role,
  inverted = false,
}: TicketCommentAuthorBadgeProps) {
  const label = getTicketCommentAuthorLabel(role);
  const className = [
    'sd-author-badge',
    `sd-author-badge--${role.replace(/_/g, '-')}`,
    inverted ? 'sd-author-badge--inverted' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return <span className={className}>{label}</span>;
}
