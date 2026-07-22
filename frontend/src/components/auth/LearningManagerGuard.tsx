import { Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from '../../context/AuthContext';
import { canManageLearning } from '../../config/roles';

export function LearningManagerGuard({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  if (!user || !canManageLearning(user)) {
    return <Navigate to="/learning" replace />;
  }
  return children;
}
