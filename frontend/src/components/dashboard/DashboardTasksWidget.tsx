import { Link } from 'react-router-dom';
import type { DashboardTaskRow } from '../../api/dashboard.types';

const STATUS_CLASS: Record<string, string> = {
  OPEN: 'close-btn',
  IN_PROGRESS: 'warning-btn',
  IN_REVIEW: 'warning-btn',
  DONE: 'success-btn',
  ARCHIVED: 'close-btn',
};

const PRIORITY_CLASS: Record<string, string> = {
  Low: 'success-btn',
  Medium: 'warning-btn',
  High: 'close-btn',
  Critical: 'close-btn',
};

interface Props {
  tasks: DashboardTaskRow[];
}

export function DashboardTasksWidget({ tasks }: Props) {
  return (
    <div className="card-style mb-30">
      <div className="title d-flex flex-wrap align-items-center justify-content-between mb-20">
        <h6 className="text-medium mb-0">Mis tareas</h6>
        <Link to="/actividades" className="dashboard-announcements__link">
          Ver tableros
        </Link>
      </div>
      {tasks.length === 0 ? (
        <p className="text-gray mb-0">No tiene tareas asignadas.</p>
      ) : (
        <div className="table-responsive">
          <table className="table top-selling-table">
            <thead>
              <tr>
                <th>
                  <h6 className="text-sm text-medium">Título</h6>
                </th>
                <th>
                  <h6 className="text-sm text-medium">Prioridad</h6>
                </th>
                <th>
                  <h6 className="text-sm text-medium">Estado</h6>
                </th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((task) => (
                <tr key={task.id}>
                  <td>
                    <Link to="/actividades" className="text-sm">
                      {task.title}
                    </Link>
                  </td>
                  <td>
                    <span
                      className={`status-btn ${PRIORITY_CLASS[task.priority] ?? 'warning-btn'}`}
                    >
                      {task.priority}
                    </span>
                  </td>
                  <td>
                    <span className={`status-btn ${STATUS_CLASS[task.status] ?? 'warning-btn'}`}>
                      {task.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
