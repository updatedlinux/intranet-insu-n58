import { useAuth } from '../../context/AuthContext';
import { isAdminRole } from '../../config/roles';
import { useAxeroDashboard } from '../../hooks/useAxeroDashboard';
import { PageHeader } from '../../components/layout';
import { DashboardIconCards } from './DashboardIconCards';
import { DashboardCharts } from './DashboardCharts';
import { DashboardTeamSection } from './DashboardTeamSection';
import { DashboardAnnouncements } from '../../components/dashboard/DashboardAnnouncements';
import { DashboardBottomSection } from './DashboardBottomSection';

export function AxeroDashboard() {
  const { user } = useAuth();
  useAxeroDashboard(true);

  const isAdmin = user ? isAdminRole(user.role.name) : false;

  return (
    <>
      <PageHeader
        title="Panel de intranet"
        breadcrumbParent="Dashboard"
        breadcrumbCurrent="Intranet"
      />
      {isAdmin && (
        <div className="alert-box primary-alert mb-30">
          <div className="alert">
            <p className="text-medium mb-0">
              Vista de administrador — gestión de colaboradores y configuración disponibles en el
              menú lateral.
            </p>
          </div>
        </div>
      )}
      <DashboardIconCards />
      <DashboardAnnouncements />
      <DashboardCharts />
      <DashboardTeamSection />
      <DashboardBottomSection />
    </>
  );
}
