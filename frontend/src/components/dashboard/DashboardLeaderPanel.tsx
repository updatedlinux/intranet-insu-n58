import type { DashboardLeaderHighlights } from '../../api/dashboard.types';

interface Props {
  data: DashboardLeaderHighlights;
}

export function DashboardLeaderPanel({ data }: Props) {
  return (
    <div className="row mb-30">
      <div className="col-lg-4">
        <div className="card-style mb-30 h-100">
          <h6 className="text-medium mb-20">Productividad del equipo</h6>
          <p className="text-gray mb-2">
            Documentos subidos (30 días): <strong>{data.documentsUploaded30Days}</strong>
          </p>
          <h6 className="text-sm text-medium mt-3 mb-2">Top colaboradores</h6>
          {data.topPerformers.length === 0 ? (
            <p className="text-gray mb-0">Sin completadas recientes.</p>
          ) : (
            <ul className="dashboard-rank-list">
              {data.topPerformers.map((p) => (
                <li key={p.userId}>
                  <span>{p.name}</span>
                  <strong>{p.completedCount}</strong>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <div className="col-lg-4">
        <div className="card-style mb-30 h-100">
          <h6 className="text-medium mb-20">Tareas vencidas por persona</h6>
          {data.overdueByUser.length === 0 ? (
            <p className="text-gray mb-0">Sin tareas vencidas.</p>
          ) : (
            <ul className="dashboard-rank-list">
              {data.overdueByUser.map((p) => (
                <li key={p.userId}>
                  <span>{p.name}</span>
                  <span className="status-btn close-btn">{p.overdueCount}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <div className="col-lg-4">
        <div className="card-style mb-30 h-100">
          <h6 className="text-medium mb-20">Solicitudes recibidas</h6>
          {data.inboxRequestsByStatus.length === 0 ? (
            <p className="text-gray mb-0">Sin solicitudes en bandeja.</p>
          ) : (
            <ul className="dashboard-rank-list">
              {data.inboxRequestsByStatus.map((r) => (
                <li key={r.status}>
                  <span>{r.label}</span>
                  <strong>{r.count}</strong>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
