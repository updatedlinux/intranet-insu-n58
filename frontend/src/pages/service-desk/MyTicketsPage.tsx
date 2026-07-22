import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Headphones, Plus, RefreshCw } from 'lucide-react';
import { ApiError } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { fetchTickets } from '../../api/tickets';
import type { Ticket } from '../../api/tickets.types';
import {
  TicketPriorityBadge,
  TicketStatusBadge,
} from '../../components/service-desk/TicketStatusBadge';
import { PageHeader } from '../../components/layout';
import { formatDateTime, formatRelativeTime } from '../../utils/relative-time';

export function MyTicketsPage() {
  const { user } = useAuth();
  const isItAgent = user?.isItSupportAgent ?? false;
  const [items, setItems] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetchTickets({ mineOnly: true });
      setItems(res.items);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudieron cargar los tickets');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <>
      <PageHeader
        title="Solicitud de Soporte TI"
        breadcrumbParent="Soporte TI"
        breadcrumbCurrent="Mis solicitudes"
        breadcrumbParentHref="/service-desk"
      />

      {isItAgent && (
        <div
          className="admin-alert mb-20"
          style={{ background: '#eff6ff', borderColor: '#bfdbfe' }}
        >
          <strong>Equipo de TI:</strong> para ver todos los tickets, métricas y gestionar
          solicitudes, use{' '}
          <Link to="/service-desk/gestion" className="admin-link">
            Mesa de ayuda TI
          </Link>{' '}
          en el menú Soporte TI.
        </div>
      )}

      <div className="sd-toolbar card-style mb-30">
        <Link to="/service-desk/nuevo" className="admin-btn admin-btn--primary">
          <Plus size={16} aria-hidden />
          Nuevo requerimiento
        </Link>
        {isItAgent && (
          <Link to="/service-desk/gestion" className="admin-btn admin-btn--primary">
            <Headphones size={16} aria-hidden />
            Mesa de ayuda TI
          </Link>
        )}
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

      <div className="card-style mb-30">
        {loading ? (
          <p className="text-gray p-20">Cargando tickets…</p>
        ) : items.length === 0 ? (
          <p className="text-gray p-20">
            No tiene tickets registrados.{' '}
            <Link to="/service-desk/nuevo">Crear un requerimiento</Link>
          </p>
        ) : (
          <div className="table-responsive">
            <table className="sd-table">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Título</th>
                  <th>Categoría</th>
                  <th>Prioridad</th>
                  <th>Estado</th>
                  <th>Creado</th>
                  <th>Asignado a</th>
                  <th>Actualizado</th>
                </tr>
              </thead>
              <tbody>
                {items.map((t) => (
                  <tr key={t.id}>
                    <td>
                      <Link to={`/service-desk/${t.id}`} className="admin-link">
                        {t.code}
                      </Link>
                    </td>
                    <td>{t.title}</td>
                    <td>{t.categoryName}</td>
                    <td>
                      <TicketPriorityBadge priority={t.priority} label={t.priorityLabel} />
                    </td>
                    <td>
                      <TicketStatusBadge status={t.status} label={t.statusLabel} />
                    </td>
                    <td title={formatRelativeTime(t.createdAt)}>{formatDateTime(t.createdAt)}</td>
                    <td>{t.assigneeName ?? 'Sin asignar'}</td>
                    <td title={formatRelativeTime(t.updatedAt)}>{formatDateTime(t.updatedAt)}</td>
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
