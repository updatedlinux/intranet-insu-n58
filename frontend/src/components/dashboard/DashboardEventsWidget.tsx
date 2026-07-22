import { Link } from 'react-router-dom';
import type { DashboardEventRow } from '../../api/dashboard.types';

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString('es-PA', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

interface Props {
  events: DashboardEventRow[];
}

export function DashboardEventsWidget({ events }: Props) {
  return (
    <div className="card-style mb-30">
      <div className="title d-flex flex-wrap align-items-center justify-content-between mb-20">
        <h6 className="text-medium mb-0">Próximos eventos</h6>
        <Link to="/eventos" className="dashboard-announcements__link">
          Ver todos
        </Link>
      </div>
      {events.length === 0 ? (
        <p className="text-gray mb-0">No hay eventos próximos para su área.</p>
      ) : (
        <ul className="dashboard-rank-list">
          {events.map((e) => (
            <li key={e.id}>
              <div>
                <Link to={`/eventos/${e.id}`}>{e.title}</Link>
                <div className="text-sm text-gray">{formatWhen(e.startDateTime)}</div>
                {e.location ? <div className="text-sm text-gray">{e.location}</div> : null}
                <div className="text-sm text-gray">{e.audienceLabel}</div>
              </div>
              {e.isCompanyWide ? <span className="status-btn primary-btn">Empresa</span> : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
