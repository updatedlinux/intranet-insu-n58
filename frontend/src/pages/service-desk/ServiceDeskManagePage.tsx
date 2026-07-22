import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Chart, registerables } from 'chart.js';
import { RefreshCw, UserPlus } from 'lucide-react';
import { ApiError } from '../../api/client';
import { fetchActiveTicketCategories } from '../../api/ticket-categories';
import type { TicketCategory } from '../../api/ticket-categories.types';
import {
  assignTicket,
  fetchTicketCapabilities,
  fetchTicketMetrics,
  fetchTickets,
} from '../../api/tickets';
import type { Ticket, TicketListFilters, TicketMetrics } from '../../api/tickets.types';
import {
  TicketPriorityBadge,
  TicketStatusBadge,
} from '../../components/service-desk/TicketStatusBadge';
import { PageHeader } from '../../components/layout';
import { Select } from '../../components/ui/Select';
import { formatDateTime, formatRelativeTime } from '../../utils/relative-time';
Chart.register(...registerables);

export function ServiceDeskManagePage() {
  const [canManage, setCanManage] = useState<boolean | null>(null);
  const [items, setItems] = useState<Ticket[]>([]);
  const [metrics, setMetrics] = useState<TicketMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState<TicketListFilters>({ activeOnly: true });
  const [categories, setCategories] = useState<TicketCategory[]>([]);
  const chartRef = useRef<HTMLCanvasElement>(null);
  const chartInstance = useRef<Chart | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [listRes, metricsRes] = await Promise.all([
        fetchTickets(filters),
        fetchTicketMetrics(),
      ]);
      setItems(listRes.items);
      setMetrics(metricsRes);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error al cargar la mesa de ayuda');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    void fetchTicketCapabilities()
      .then((c) => setCanManage(c.canManageDesk))
      .catch(() => setCanManage(false));
    void fetchActiveTicketCategories()
      .then((r) => setCategories(r.items))
      .catch(() => setCategories([]));
  }, []);

  useEffect(() => {
    if (canManage) void load();
  }, [canManage, load]);

  useEffect(() => {
    if (!chartRef.current || !metrics?.byCategory.length) return;

    chartInstance.current?.destroy();
    chartInstance.current = new Chart(chartRef.current, {
      type: 'doughnut',
      data: {
        labels: metrics.byCategory.map((c) => c.categoryName),
        datasets: [
          {
            data: metrics.byCategory.map((c) => c.count),
            backgroundColor: ['#002b4e', '#0369a1', '#0d9488', '#ca8a04', '#64748b'],
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom' } },
      },
    });

    return () => chartInstance.current?.destroy();
  }, [metrics]);

  const handleQuickTake = (ticketId: number) => {
    void (async () => {
      try {
        await assignTicket(ticketId);
        await load();
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'No se pudo tomar el ticket');
      }
    })();
  };

  if (canManage === false) {
    return <Navigate to="/service-desk" replace />;
  }

  if (canManage === null) {
    return <p className="text-gray">Cargando…</p>;
  }

  return (
    <>
      <PageHeader
        title="Mesa de ayuda TI"
        breadcrumbParent="Soporte TI"
        breadcrumbCurrent="Gestión de tickets"
        breadcrumbParentHref="/service-desk/gestion"
      />

      {metrics && (
        <div className="sd-metrics">
          <div className="sd-metric-card card-style">
            <div className="sd-metric-card__value">{metrics.openCount}</div>
            <div className="sd-metric-card__label">Tickets abiertos</div>
          </div>
          <div className="sd-metric-card card-style">
            <div className="sd-metric-card__value">{metrics.inProgressCount}</div>
            <div className="sd-metric-card__label">En progreso</div>
          </div>
          <div className="sd-metric-card card-style">
            <div className="sd-metric-card__value">
              {metrics.avgResolutionHours != null ? `${metrics.avgResolutionHours} h` : '—'}
            </div>
            <div className="sd-metric-card__label">Tiempo promedio de resolución</div>
          </div>
        </div>
      )}

      {metrics && metrics.byCategory.length > 0 && (
        <div className="sd-chart-wrap card-style">
          <h6 className="mb-15">Tickets activos por categoría</h6>
          <div style={{ height: 220 }}>
            <canvas ref={chartRef} />
          </div>
        </div>
      )}

      <div className="sd-toolbar card-style mb-30">
        <div style={{ maxWidth: 160 }}>
          <Select
            value={filters.status ?? ''}
            onChange={(v) =>
              setFilters((f) => ({
                ...f,
                status: v ? (v as TicketListFilters['status']) : undefined,
              }))
            }
            options={[
              { value: '', label: 'Todos los estados' },
              { value: 'OPEN', label: 'Abierto' },
              { value: 'IN_PROGRESS', label: 'En progreso' },
              { value: 'ON_HOLD', label: 'En espera' },
              { value: 'RESOLVED', label: 'Resuelto' },
            ]}
          />
        </div>
        <div style={{ maxWidth: 160 }}>
          <Select
            value={filters.categoryId != null ? String(filters.categoryId) : ''}
            onChange={(v) =>
              setFilters((f) => ({
                ...f,
                categoryId: v ? Number.parseInt(v, 10) : undefined,
              }))
            }
            placeholder="Categoría"
            options={categories.map((c) => ({ value: String(c.id), label: c.name }))}
          />
        </div>
        <div style={{ maxWidth: 140 }}>
          <Select
            value={filters.priority ?? ''}
            onChange={(v) =>
              setFilters((f) => ({
                ...f,
                priority: v ? (v as TicketListFilters['priority']) : undefined,
              }))
            }
            placeholder="Prioridad"
            options={[
              { value: 'Critical', label: 'Crítica' },
              { value: 'High', label: 'Alta' },
              { value: 'Medium', label: 'Media' },
              { value: 'Low', label: 'Baja' },
            ]}
          />
        </div>
        <input
          type="search"
          className="admin-form__input"
          placeholder="Buscar código, título…"
          style={{ maxWidth: 220 }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              setFilters((f) => ({ ...f, search: (e.target as HTMLInputElement).value }));
            }
          }}
        />
        <button
          type="button"
          className="admin-btn admin-btn--ghost"
          onClick={() => void load()}
          disabled={loading}
        >
          <RefreshCw size={16} aria-hidden />
          Actualizar
        </button>
      </div>

      {error && <div className="admin-alert admin-alert--error mb-20">{error}</div>}

      <div className="card-style">
        {loading ? (
          <p className="text-gray p-20">Cargando…</p>
        ) : items.length === 0 ? (
          <p className="text-gray p-20">No hay tickets con los filtros seleccionados.</p>
        ) : (
          <div className="table-responsive">
            <table className="sd-table">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Título</th>
                  <th>Solicitante</th>
                  <th>Prioridad</th>
                  <th>Estado</th>
                  <th>Asignado</th>
                  <th>Creado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {items.map((t) => (
                  <tr key={t.id}>
                    <td>
                      <Link to={`/service-desk/gestion/${t.id}`} className="admin-link">
                        {t.code}
                      </Link>
                    </td>
                    <td>{t.title}</td>
                    <td>
                      {t.requesterName}
                      <br />
                      <span className="text-gray" style={{ fontSize: '0.75rem' }}>
                        {t.requesterAreaName}
                      </span>
                    </td>
                    <td>
                      <TicketPriorityBadge priority={t.priority} label={t.priorityLabel} />
                    </td>
                    <td>
                      <TicketStatusBadge status={t.status} label={t.statusLabel} />
                    </td>
                    <td>{t.assigneeName ?? '—'}</td>
                    <td title={formatRelativeTime(t.createdAt)}>{formatDateTime(t.createdAt)}</td>
                    <td>
                      <div className="d-flex gap-2 flex-wrap">
                        {!t.assignedTo && t.status !== 'CLOSED' && (
                          <button
                            type="button"
                            className="admin-btn admin-btn--ghost admin-btn--sm"
                            onClick={() => handleQuickTake(t.id)}
                            title="Tomar ticket"
                          >
                            <UserPlus size={14} aria-hidden />
                          </button>
                        )}
                        <Link
                          to={`/service-desk/gestion/${t.id}`}
                          className="admin-btn admin-btn--ghost admin-btn--sm"
                        >
                          Gestionar
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
