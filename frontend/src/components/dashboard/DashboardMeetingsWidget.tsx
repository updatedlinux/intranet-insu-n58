import { Link } from 'react-router-dom';
import type { DashboardMeetingRow } from '../../api/dashboard.types';

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
  meetings: DashboardMeetingRow[];
}

export function DashboardMeetingsWidget({ meetings }: Props) {
  return (
    <div className="card-style mb-30">
      <div className="title d-flex flex-wrap align-items-center justify-content-between mb-20">
        <h6 className="text-medium mb-0">Próximas reuniones</h6>
        <Link to="/reuniones" className="dashboard-announcements__link">
          Ver agenda
        </Link>
      </div>
      {meetings.length === 0 ? (
        <p className="text-gray mb-0">No tiene reuniones próximas.</p>
      ) : (
        <ul className="dashboard-rank-list">
          {meetings.map((m) => (
            <li key={m.id}>
              <div>
                <Link to={`/reuniones/${m.id}`}>{m.title}</Link>
                <div className="text-sm text-gray">{formatWhen(m.startDateTime)}</div>
                {m.location ? <div className="text-sm text-gray">{m.location}</div> : null}
              </div>
              {m.isToday ? <span className="status-btn success-btn">Hoy</span> : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
