import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const ALLOWED_PATHS = ['/cambiar-contrasena'];

/**
 * Redirige a cambio de contraseña cuando mustChangePassword está activo.
 * Aplica a todos los roles (colaborador y admin).
 */
export function MustChangePasswordGuard() {
  const { user } = useAuth();
  const location = useLocation();

  if (user?.mustChangePassword && !ALLOWED_PATHS.includes(location.pathname)) {
    return <Navigate to="/cambiar-contrasena" replace state={{ forced: true }} />;
  }

  return <Outlet />;
}
