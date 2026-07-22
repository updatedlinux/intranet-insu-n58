import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { UserCircle } from 'lucide-react';
import { fetchDashboard } from '../../api/dashboard';
import type { DashboardPayload } from '../../api/dashboard.types';
import { PageHeader } from '../../components/layout';
import { DashboardAnnouncements } from '../../components/dashboard/DashboardAnnouncements';
import { DashboardAlerts } from '../../components/dashboard/DashboardAlerts';
import { DashboardAdminPanel } from '../../components/dashboard/DashboardAdminPanel';
import { DashboardCharts } from '../../components/dashboard/DashboardCharts';
import { DashboardLeaderPanel } from '../../components/dashboard/DashboardLeaderPanel';
import { DashboardMeetingsWidget } from '../../components/dashboard/DashboardMeetingsWidget';
import { DashboardEventsWidget } from '../../components/dashboard/DashboardEventsWidget';
import { DashboardOrgChartWidget } from '../../components/dashboard/DashboardOrgChartWidget';
import { DashboardMotivationalQuote } from '../../components/dashboard/DashboardMotivationalQuote';
import { DashboardNotificationsWidget } from '../../components/dashboard/DashboardNotificationsWidget';
import { DashboardQuickAccess } from '../../components/dashboard/DashboardQuickAccess';
import { DashboardSkeleton } from '../../components/dashboard/DashboardSkeleton';
import { DashboardStats } from '../../components/dashboard/DashboardStats';
import { DashboardTasksWidget } from '../../components/dashboard/DashboardTasksWidget';

const VARIANT_LABEL: Record<DashboardPayload['variant'], string> = {
  collaborator: 'Colaborador',
  leader: 'Líder de área',
  ti: 'Soporte TI',
  admin: 'Administrador',
};

export function SmartDashboard() {
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetchDashboard()
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : 'Error al cargar el panel'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <>
        <PageHeader title="Inicio" breadcrumbParent="Intranet" breadcrumbCurrent="Panel" />
        <DashboardSkeleton />
      </>
    );
  }

  if (error || !data) {
    return (
      <>
        <PageHeader title="Inicio" breadcrumbParent="Intranet" breadcrumbCurrent="Panel" />
        <div className="alert-box primary-alert mb-30">
          <div className="alert">
            <p className="text-medium mb-0">{error ?? 'No se pudo cargar el dashboard.'}</p>
          </div>
        </div>
      </>
    );
  }

  const firstName = data.user.name.split(' ')[0] ?? data.user.name;

  return (
    <>
      <PageHeader title="Inicio" breadcrumbParent="Intranet" breadcrumbCurrent="Panel" />

      <div className="collab-hero card-style mb-30">
        <div className="collab-hero__content">
          <p className="collab-hero__greeting">Hola, {firstName}</p>
          <h2 className="collab-hero__title">Bienvenido a la intranet de N58 Banco Digital</h2>
          <p className="collab-hero__subtitle text-gray mb-0">
            Vista {VARIANT_LABEL[data.variant]} — información y accesos según su rol.
          </p>
        </div>
        <Link to="/mi-perfil" className="admin-btn admin-btn--primary">
          <UserCircle size={18} aria-hidden />
          Mi perfil
        </Link>
      </div>

      <DashboardMotivationalQuote quote={data.motivationalQuote} featured />

      <DashboardStats cards={data.stats.cards} />

      <div className="row mb-30">
        <div className="col-lg-5">
          <div className="card-style dashboard-profile h-100 mb-30">
            <h6 className="text-medium mb-20">Tu información</h6>
            <dl>
              <dt>Nombre</dt>
              <dd>{data.user.name}</dd>
              <dt>Área</dt>
              <dd>{data.user.area}</dd>
              <dt>Cargo</dt>
              <dd>{data.user.position}</dd>
              <dt>Jefe inmediato</dt>
              <dd>{data.user.manager?.name ?? 'No asignado'}</dd>
            </dl>
          </div>
        </div>
        <div className="col-lg-7">
          <div className="card-style h-100 mb-30">
            <h6 className="text-medium mb-20">Accesos rápidos</h6>
            <DashboardQuickAccess items={data.quickAccess} />
          </div>
        </div>
      </div>

      <DashboardOrgChartWidget />

      {data.variant === 'admin' ? (
        <div className="alert-box primary-alert mb-30">
          <div className="alert">
            <p className="text-medium mb-0">
              Vista global de administración — métricas consolidadas de toda la plataforma.
            </p>
          </div>
        </div>
      ) : null}

      {data.alerts.length > 0 ? <DashboardAlerts alerts={data.alerts} /> : null}

      <DashboardCharts variant={data.variant} charts={data.charts} />

      {data.highlights.leader ? <DashboardLeaderPanel data={data.highlights.leader} /> : null}
      {data.highlights.admin ? <DashboardAdminPanel data={data.highlights.admin} /> : null}

      <DashboardAnnouncements />

      <DashboardTasksWidget tasks={data.highlights.tasks} />

      <div className="row mb-30">
        <div className="col-lg-6">
          <DashboardMeetingsWidget meetings={data.highlights.meetings} />
        </div>
        <div className="col-lg-6">
          <DashboardEventsWidget events={data.highlights.events ?? []} />
        </div>
      </div>

      <div className="row mb-30">
        <div className="col-lg-12">
          <DashboardNotificationsWidget items={data.highlights.notifications} />
        </div>
      </div>
    </>
  );
}
