import { useCallback, useEffect, useState } from 'react';
import { fetchBoardMetrics } from '../../api/boards';
import type { BoardMetrics } from '../../api/boards.types';

interface BoardMetricsPanelProps {
  boardId: number;
  onOpenTask: (taskId: number) => void;
}

export function BoardMetricsPanel({ boardId, onOpenTask }: BoardMetricsPanelProps) {
  const [metrics, setMetrics] = useState<BoardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchBoardMetrics(boardId);
      setMetrics(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar métricas');
    } finally {
      setLoading(false);
    }
  }, [boardId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <p className="text-gray p-20">Cargando métricas…</p>;
  if (error) return <div className="admin-alert admin-alert--error">{error}</div>;
  if (!metrics) return null;

  const maxAssigneeCount = Math.max(...metrics.byAssignee.map((a) => a.count), 1);

  return (
    <div className="kanban-metrics">
      <div className="kanban-metrics__cards">
        <div className="kanban-metric-card">
          <span className="kanban-metric-card__value">{metrics.summary.totalTasks}</span>
          <span className="kanban-metric-card__label">Total tareas</span>
        </div>
        <div className="kanban-metric-card">
          <span className="kanban-metric-card__value">{metrics.summary.completed}</span>
          <span className="kanban-metric-card__label">Completadas</span>
        </div>
        <div className="kanban-metric-card">
          <span className="kanban-metric-card__value">{metrics.summary.inProgress}</span>
          <span className="kanban-metric-card__label">En progreso</span>
        </div>
        <div className="kanban-metric-card is-warning">
          <span className="kanban-metric-card__value">{metrics.summary.overdue}</span>
          <span className="kanban-metric-card__label">Vencidas</span>
        </div>
      </div>

      <div className="kanban-metrics__grid">
        <div className="card-style kanban-metrics__chart">
          <h3>Tareas por colaborador</h3>
          {metrics.byAssignee.length === 0 ? (
            <p className="text-gray">Sin asignaciones activas</p>
          ) : (
            <ul className="kanban-bar-chart">
              {metrics.byAssignee.map((row) => (
                <li key={row.userId}>
                  <span className="kanban-bar-chart__label">{row.name}</span>
                  <div className="kanban-bar-chart__track">
                    <div
                      className="kanban-bar-chart__fill"
                      style={{ width: `${(row.count / maxAssigneeCount) * 100}%` }}
                    />
                  </div>
                  <span className="kanban-bar-chart__count">{row.count}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card-style">
          <h3>Resumen adicional</h3>
          <ul className="kanban-metrics__stats">
            <li>
              Completadas (30 días): <strong>{metrics.completedLast30Days}</strong>
            </li>
            <li>
              Tiempo promedio de completado:{' '}
              <strong>
                {metrics.avgCompletionHours != null ? `${metrics.avgCompletionHours} h` : '—'}
              </strong>
            </li>
          </ul>
        </div>
      </div>

      {metrics.overdueTasks.length > 0 && (
        <div className="card-style kanban-metrics__overdue">
          <h3>Tareas vencidas</h3>
          <ul>
            {metrics.overdueTasks.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  className="kanban-overdue-link"
                  onClick={() => onOpenTask(t.id)}
                >
                  {t.title}
                </button>
                <span className="text-gray">
                  {t.dueDate ? new Date(t.dueDate).toLocaleDateString('es-ES') : ''} ·{' '}
                  {t.priorityLabel}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
