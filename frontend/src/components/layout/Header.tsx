import { Link, useNavigate } from 'react-router-dom';
import { Hand } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getRoleLabel } from '../../config/roles';
import { UserAvatar } from '../admin/UserAvatar';
import { NotificationDropdown } from './header/NotificationDropdown';
import { MessageDropdown } from './header/MessageDropdown';

interface HeaderProps {
  menuIcon: 'lni-chevron-left' | 'lni-menu';
  onMenuToggle: () => void;
}

export function Header({ menuIcon, onMenuToggle }: HeaderProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const fullName = user ? `${user.firstName} ${user.lastName}` : 'Usuario';
  const roleLabel = user ? getRoleLabel(user.role.name) : '';

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const profileAvatar =
    user != null ? (
      <UserAvatar
        userId={user.id}
        firstName={user.firstName}
        lastName={user.lastName}
        avatarUrl={user.avatarUrl}
        size="sm"
        variant="brand"
      />
    ) : null;

  return (
    <header className="header">
      <div className="container-fluid">
        <div className="row">
          <div className="col-lg-5 col-md-5 col-6">
            <div className="header-left d-flex align-items-center">
              <div className="menu-toggle-btn mr-15">
                <button
                  id="menu-toggle"
                  type="button"
                  className="main-btn primary-btn btn-hover"
                  onClick={onMenuToggle}
                >
                  <i className={`lni ${menuIcon} me-2`} aria-hidden /> Menú
                </button>
              </div>
              <div className="header-search d-none d-md-flex">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                  }}
                >
                  <input type="search" placeholder="Buscar..." aria-label="Buscar" />
                  <button type="submit" aria-label="Ejecutar búsqueda">
                    <i className="lni lni-search-alt" aria-hidden />
                  </button>
                </form>
              </div>
            </div>
          </div>
          <div className="col-lg-7 col-md-7 col-6">
            <div className="header-right d-flex align-items-center justify-content-end">
              <div className="welcome-message position-absolute top-50 start-50 translate-middle d-none d-xl-flex align-items-center">
                <span className="header-welcome-accent" aria-hidden>
                  <Hand size={20} strokeWidth={2} />
                </span>
                <h1 className="mb-0">Bienvenido de nuevo, {user?.firstName ?? 'Usuario'}</h1>
              </div>
              <div className="header-actions">
                <NotificationDropdown />
                <MessageDropdown />
                <div className="profile-box">
                  <button
                    className="dropdown-toggle bg-transparent border-0"
                    type="button"
                    id="profile"
                    data-bs-toggle="dropdown"
                    aria-expanded="false"
                  >
                    <div className="profile-info">
                      <div className="info">
                        <div className="image">{profileAvatar}</div>
                        <div>
                          <h6 className="fw-500">{fullName}</h6>
                          <p>{roleLabel}</p>
                        </div>
                      </div>
                    </div>
                  </button>
                  <ul className="dropdown-menu dropdown-menu-end" aria-labelledby="profile">
                    <li>
                      <div className="author-info flex items-center !p-1">
                        <div className="image">{profileAvatar}</div>
                        <div className="content">
                          <h4 className="text-sm">{fullName}</h4>
                          <span className="text-xs text-gray">{user?.email}</span>
                        </div>
                      </div>
                    </li>
                    <li className="divider" />
                    <li>
                      <Link to="/mi-perfil">
                        <i className="lni lni-user" aria-hidden /> Mi perfil
                      </Link>
                    </li>
                    <li>
                      <Link to="/cambiar-contrasena">
                        <i className="lni lni-lock" aria-hidden /> Cambiar contraseña
                      </Link>
                    </li>
                    <li className="divider" />
                    <li>
                      <button type="button" className="dropdown-item-btn" onClick={handleLogout}>
                        <i className="lni lni-enter" aria-hidden /> Cerrar sesión
                      </button>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

/** @deprecated Alias de compatibilidad */
export const Navbar = Header;
