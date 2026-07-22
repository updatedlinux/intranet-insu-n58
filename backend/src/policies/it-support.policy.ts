import type { AuthenticatedUser } from '../types/auth';

export function isItSupportAgent(user: Pick<AuthenticatedUser, 'isItSupportAgent'>): boolean {
  return Boolean(user.isItSupportAgent);
}
