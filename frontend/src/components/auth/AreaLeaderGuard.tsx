import { Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from '../../context/AuthContext';
import { canViewActivityMetrics } from '../../config/roles';

/** Líderes de área y administradores del sistema pueden acceder a métricas de actividades. */
export function AreaLeaderGuard({ children }: { children: ReactNode }) {
  const { user } = useAuth();

  if (!user || !canViewActivityMetrics(user)) {
    return <Navigate to="/actividades" replace />;
  }

  return children;
}
