import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Inbox, Plus, RefreshCw } from 'lucide-react';
import { ApiError } from '../../api/client';
import { fetchInboxRequests, fetchMyRequests } from '../../api/requests';
import type { InternalRequest, RequestPriority, RequestStatus } from '../../api/requests.types';
import { RequestCreateModal } from '../../components/requests/RequestCreateModal';
import { RequestPriorityBadge, RequestStatusBadge } from '../../components/requests/RequestBadges';
import { PageHeader } from '../../components/layout';
import { Select } from '../../components/ui/Select';
import { useAuth } from '../../context/AuthContext';
import { isAdminRole, isAreaLeader } from '../../config/roles';
import { formatDateTime } from '../../utils/relative-time';

type Tab = 'mine' | 'inbox';

export function RequestsPage() {
  const { user } = useAuth();
  const showInbox = user ? isAreaLeader(user) || isAdminRole(user.role.name) : false;

  const [tab, setTab] = useState<Tab>('mine');
  const [items, setItems] = useState<InternalRequest[]>([]);
  const [submittedCount, setSubmittedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);

  const [statusFilter, setStatusFilter] = useState<RequestStatus | ''>('');
  const [priorityFilter, setPriorityFilter] = useState<RequestPriority | ''>('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      if (tab === 'mine') {
        const res = await fetchMyRequests({
          status: statusFilter || undefined,
        });
        setItems(res.items);
        setSubmittedCount(0);
      } else {
        const res = await fetchInboxRequests({
          status: statusFilter || undefined,
          priority: priorityFilter || undefined,
        });
        setItems(res.items);
        setSubmittedCount(res.submittedCount);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudieron cargar las solicitudes');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [tab, statusFilter, priorityFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <>
      <PageHeader
        title="Solicitudes"
        breadcrumbParent="Comunicación"
        breadcrumbCurrent="Solicitudes"
        breadcrumbParentHref="/solicitudes"
      />

      <div className="req-toolbar card-style mb-30">
        <div className="req-tabs" role="tablist" aria-label="Vistas de solicitudes">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'mine'}
            className={`req-tabs__btn${tab === 'mine' ? ' is-active' : ''}`}
            onClick={() => setTab('mine')}
          >
            Mis solicitudes
          </button>
          {showInbox && (
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'inbox'}
              className={`req-tabs__btn${tab === 'inbox' ? ' is-active' : ''}`}
              onClick={() => setTab('inbox')}
            >
              Bandeja de solicitudes
              {submittedCount > 0 && tab !== 'inbox' && (
                <span className="req-tabs__badge">
                  {submittedCount > 9 ? '9+' : submittedCount}
                </span>
              )}
            </button>
          )}
        </div>

        <div className="req-toolbar__actions">
          {tab === 'mine' && (
            <button
              type="button"
              className="admin-btn admin-btn--primary"
              onClick={() => setModalOpen(true)}
            >
              <Plus size={16} aria-hidden />
              Nueva solicitud
            </button>
          )}
          {tab === 'inbox' && submittedCount > 0 && (
            <span className="req-inbox-hint">
              <Inbox size={16} aria-hidden />
              {submittedCount} sin atender
            </span>
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
      </div>

      <div className="card-style mb-20 req-filters">
        <label className="req-filters__field">
          Estado
          <Select
            value={statusFilter}
            onChange={(v) => setStatusFilter(v as RequestStatus | '')}
            options={[
              { value: '', label: 'Todos' },
              { value: 'SUBMITTED', label: 'Enviada' },
              { value: 'RECEIVED', label: 'Recibida' },
              { value: 'IN_PROGRESS', label: 'En proceso' },
              { value: 'RESOLVED', label: 'Resuelta' },
              { value: 'REJECTED', label: 'Rechazada' },
              { value: 'CLOSED', label: 'Cerrada' },
            ]}
          />
        </label>
        {tab === 'inbox' && (
          <label className="req-filters__field">
            Prioridad
            <Select
              value={priorityFilter}
              onChange={(v) => setPriorityFilter(v as RequestPriority | '')}
              options={[
                { value: '', label: 'Todas' },
                { value: 'Low', label: 'Baja' },
                { value: 'Medium', label: 'Media' },
                { value: 'High', label: 'Alta' },
              ]}
            />
          </label>
        )}
      </div>

      {error && <div className="admin-alert admin-alert--error mb-20">{error}</div>}

      <div className="card-style">
        {loading ? (
          <p className="text-gray p-20">Cargando solicitudes…</p>
        ) : items.length === 0 ? (
          <p className="text-gray p-20">
            {tab === 'mine'
              ? 'No tiene solicitudes registradas.'
              : 'No hay solicitudes en la bandeja con los filtros seleccionados.'}
          </p>
        ) : (
          <div className="table-responsive">
            <table className="req-table">
              <thead>
                <tr>
                  <th>Código</th>
                  {tab === 'inbox' && <th>Solicitante</th>}
                  <th>Título</th>
                  {tab === 'mine' && <th>Área destino</th>}
                  <th>Prioridad</th>
                  <th>Estado</th>
                  <th>Fecha</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <Link
                        to={`/solicitudes/${item.id}${tab === 'inbox' ? '?vista=bandeja' : ''}`}
                        className="admin-link"
                      >
                        {item.code}
                      </Link>
                    </td>
                    {tab === 'inbox' && (
                      <td>
                        <span className="req-requester">{item.requesterName}</span>
                        <span className="req-requester-area">{item.requesterAreaName}</span>
                      </td>
                    )}
                    <td>{item.title}</td>
                    {tab === 'mine' && <td>{item.targetAreaName}</td>}
                    <td>
                      <RequestPriorityBadge priority={item.priority} />
                    </td>
                    <td>
                      <RequestStatusBadge status={item.status} />
                    </td>
                    <td>{formatDateTime(item.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <RequestCreateModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={() => void load()}
      />
    </>
  );
}
