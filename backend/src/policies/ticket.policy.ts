import { isAdminRole } from '../constants/roles';
import { isItSupportAgent } from './it-support.policy';
import { TICKET_STATUS, type TicketStatus } from '../constants/ticket-status';
import type { TicketRow } from '../repositories/ticket.repository';
import { findActiveUserInItAreas } from '../repositories/ticket.repository';
import type { AuthenticatedUser } from '../types/auth';

export function isItAgent(user: AuthenticatedUser): boolean {
  return isItSupportAgent(user);
}

export async function isItAgentUserId(userId: number): Promise<boolean> {
  return findActiveUserInItAreas(userId);
}

export function canViewTicket(user: AuthenticatedUser, ticket: TicketRow): boolean {
  if (canManageTicket(user)) return true;
  return ticket.requesterId === user.id;
}

export function canManageTicket(user: AuthenticatedUser): boolean {
  return isAdminRole(user.roleName) || isItAgent(user);
}

export function canCommentOnTicket(user: AuthenticatedUser, ticket: TicketRow): boolean {
  if (ticket.status === TICKET_STATUS.CLOSED) return false;
  return canViewTicket(user, ticket);
}

export function canAssignTicket(user: AuthenticatedUser): boolean {
  return canManageTicket(user);
}

export function canUpdateTicketFields(user: AuthenticatedUser): boolean {
  return canManageTicket(user);
}

export function canCloseTicket(user: AuthenticatedUser, ticket: TicketRow): boolean {
  return ticket.requesterId === user.id && ticket.status === TICKET_STATUS.RESOLVED;
}

const IT_STATUS_TRANSITIONS: Partial<Record<TicketStatus, TicketStatus[]>> = {
  OPEN: [TICKET_STATUS.IN_PROGRESS, TICKET_STATUS.ON_HOLD, TICKET_STATUS.RESOLVED],
  IN_PROGRESS: [TICKET_STATUS.ON_HOLD, TICKET_STATUS.RESOLVED, TICKET_STATUS.OPEN],
  ON_HOLD: [TICKET_STATUS.IN_PROGRESS, TICKET_STATUS.RESOLVED],
  RESOLVED: [TICKET_STATUS.IN_PROGRESS, TICKET_STATUS.CLOSED],
};

export function canItChangeStatus(from: TicketStatus, to: TicketStatus): boolean {
  const allowed = IT_STATUS_TRANSITIONS[from];
  return allowed?.includes(to) ?? false;
}
