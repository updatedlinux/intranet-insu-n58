import { isAdminRole } from '../constants/roles';
import { isItSupportAgent } from './it-support.policy';
import type { AuthenticatedUser } from '../types/auth';

export function canAccessItInventory(user: AuthenticatedUser): boolean {
  return isAdminRole(user.roleName) || isItSupportAgent(user);
}
