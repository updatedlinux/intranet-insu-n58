import { Link } from 'react-router-dom';
import type { DashboardAlert } from '../../api/dashboard.types';

interface Props {
  alerts: DashboardAlert[];
}

export function DashboardAlerts({ alerts }: Props) {
  if (!alerts.length) return null;

  return (
    <div className="card-style mb-30">
      <h6 className="text-medium mb-20">Alertas</h6>
      {alerts.map((alert) => {
        const body = (
          <>
            <div>
              <strong>{alert.title}</strong>
              <p className="mb-0 text-sm text-gray">{alert.message}</p>
            </div>
          </>
        );
        const className = `dashboard-alert dashboard-alert--${alert.severity}`;
        return alert.href ? (
          <Link key={alert.id} to={alert.href} className={className}>
            {body}
          </Link>
        ) : (
          <div key={alert.id} className={className}>
            {body}
          </div>
        );
      })}
    </div>
  );
}
