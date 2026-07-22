import type { TicketCommentAuthorRole } from '../api/tickets.types';

const AUTHOR_ROLE_LABELS: Record<TicketCommentAuthorRole, string> = {
  requester: 'Solicitante',
  it_assignee: 'Agente TI · asignado',
  it_agent: 'Agente TI',
};

export function getTicketCommentAuthorLabel(role: TicketCommentAuthorRole): string {
  return AUTHOR_ROLE_LABELS[role];
}
