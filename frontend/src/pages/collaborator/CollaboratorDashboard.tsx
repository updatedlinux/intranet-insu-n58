import { Link } from 'react-router-dom';
import { Megaphone, CalendarDays, FileText, BookUser, UserCircle, Lock } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getRoleLabel } from '../../config/roles';
import { PageHeader } from '../../components/layout';

const QUICK_LINKS = [
  { to: '/comunicados', label: 'Comunicados', icon: Megaphone, description: 'Avisos internos' },
  { to: '/eventos', label: 'Eventos', icon: CalendarDays, description: 'Calendario corporativo' },
  { to: '/documentos', label: 'Documentos', icon: FileText, description: 'Archivos compartidos' },
  { to: '/directorio', label: 'Directorio', icon: BookUser, description: 'Contactos del equipo' },
] as const;

function formatDate(iso: string | null) {
  if (!iso) return 'Sin registros';
  return new Date(iso).toLocaleString('es-PA', { dateStyle: 'medium', timeStyle: 'short' });
}

export function CollaboratorDashboard() {
  const { user } = useAuth();

  if (!user) return null;

  const fullName = `${user.firstName} ${user.lastName}`;

  return (
    <>
      <PageHeader title="Inicio" breadcrumbParent="Intranet" breadcrumbCurrent="Panel" />

      <div className="collab-hero card-style mb-30">
        <div className="collab-hero__content">
          <p className="collab-hero__greeting">Hola, {user.firstName}</p>
          <h2 className="collab-hero__title">Bienvenido a la intranet de Insular Cambios</h2>
          <p className="collab-hero__subtitle text-gray mb-0">
            Consulta comunicados, accede a documentos y mantén tu información de cuenta al día.
          </p>
        </div>
        <Link to="/mi-perfil" className="admin-btn admin-btn--primary">
          <UserCircle size={18} aria-hidden />
          Mi perfil
        </Link>
      </div>

      <div className="row mb-30">
        <div className="col-lg-5">
          <div className="card-style collab-profile-card h-100">
            <h6 className="text-medium mb-20">Tu información</h6>
            <dl className="collab-profile-card__list">
              <div>
                <dt>Nombre</dt>
                <dd>{fullName}</dd>
              </div>
              <div>
                <dt>Email</dt>
                <dd>{user.email}</dd>
              </div>
              <div>
                <dt>Rol</dt>
                <dd>{getRoleLabel(user.role.name)}</dd>
              </div>
              <div>
                <dt>Área</dt>
                <dd>{user.area.name}</dd>
              </div>
              <div>
                <dt>Cargo</dt>
                <dd>{user.position.name}</dd>
              </div>
              <div>
                <dt>Último acceso</dt>
                <dd>{formatDate(user.lastLoginAt)}</dd>
              </div>
            </dl>
            <Link
              to="/cambiar-contrasena"
              className="admin-btn admin-btn--ghost admin-btn--sm mt-2"
            >
              <Lock size={16} aria-hidden />
              Cambiar contraseña
            </Link>
          </div>
        </div>
        <div className="col-lg-7">
          <div className="card-style h-100">
            <h6 className="text-medium mb-20">Accesos rápidos</h6>
            <div className="collab-quick-grid">
              {QUICK_LINKS.map((item) => {
                const Icon = item.icon;
                return (
                  <Link key={item.to} to={item.to} className="collab-quick-card">
                    <span className="collab-quick-card__icon" aria-hidden>
                      <Icon size={22} strokeWidth={1.75} />
                    </span>
                    <span className="collab-quick-card__label">{item.label}</span>
                    <span className="collab-quick-card__desc">{item.description}</span>
                    <span className="collab-quick-card__badge">Próximamente</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
