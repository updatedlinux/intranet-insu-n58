import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { isAdminRole } from '../../config/roles';

export function ItInventoryGuard({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  if (!user) return <Navigate to="/login" replace />;
  if (!isAdminRole(user.role.name) && !user.isItSupportAgent) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
