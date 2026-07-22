import type { DashboardNotificationRow } from '../../api/dashboard.types';

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString('es-PA', { dateStyle: 'short', timeStyle: 'short' });
}

interface Props {
  items: DashboardNotificationRow[];
}

export function DashboardNotificationsWidget({ items }: Props) {
  return (
    <div className="card-style mb-30">
      <div className="title d-flex flex-wrap align-items-center justify-content-between mb-20">
        <h6 className="text-medium mb-0">Notificaciones recientes</h6>
      </div>
      {items.length === 0 ? (
        <p className="text-gray mb-0">Sin notificaciones recientes.</p>
      ) : (
        <ul className="dashboard-rank-list">
          {items.map((n) => (
            <li key={n.id}>
              <div>
                <strong>{n.title}</strong>
                <div className="text-sm text-gray">{n.message}</div>
                <div className="text-sm text-gray">{formatWhen(n.createdAt)}</div>
              </div>
              {!n.isRead ? <span className="status-btn warning-btn">Nueva</span> : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
