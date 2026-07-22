import type { DashboardAdminHighlights } from '../../api/dashboard.types';

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString('es-PA', { dateStyle: 'short', timeStyle: 'short' });
}

interface Props {
  data: DashboardAdminHighlights;
}

export function DashboardAdminPanel({ data }: Props) {
  return (
    <div className="row mb-30">
      <div className="col-lg-6">
        <div className="card-style mb-30 h-100">
          <h6 className="text-medium mb-20">Áreas más activas (30 días)</h6>
          {data.topAreas.length === 0 ? (
            <p className="text-gray mb-0">Sin actividad registrada.</p>
          ) : (
            <ul className="dashboard-rank-list">
              {data.topAreas.map((a) => (
                <li key={a.areaId}>
                  <span>{a.areaName}</span>
                  <strong>{a.activityScore}</strong>
                </li>
              ))}
            </ul>
          )}
          {data.busiestArea ? (
            <p className="text-gray mt-3 mb-0">
              Mayor carga operativa: <strong>{data.busiestArea.areaName}</strong> (
              {data.busiestArea.openTasks} tareas abiertas)
            </p>
          ) : null}
        </div>
      </div>
      <div className="col-lg-6">
        <div className="card-style mb-30 h-100">
          <h6 className="text-medium mb-20">Actividad reciente del sistema</h6>
          {data.recentAudit.length === 0 ? (
            <p className="text-gray mb-0">Sin registros de auditoría.</p>
          ) : (
            <ul className="dashboard-rank-list">
              {data.recentAudit.map((log) => (
                <li key={log.id}>
                  <div>
                    <strong>{log.action}</strong>
                    <div className="text-sm text-gray">
                      {log.actorName ?? 'Sistema'} · {formatWhen(log.createdAt)}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
