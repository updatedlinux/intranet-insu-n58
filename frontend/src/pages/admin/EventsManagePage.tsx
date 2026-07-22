import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Eye, Plus, RefreshCw } from 'lucide-react';
import { ApiError } from '../../api/client';
import { cancelEvent, fetchEventsManage, publishEvent } from '../../api/events';
import type { CorporateEvent, CorporateEventStatus } from '../../api/events.types';
import { ConfirmModal } from '../../components/admin/ConfirmModal';
import { AdminGovernanceBanner } from '../../components/admin/AdminGovernanceBanner';
import { PageHeader } from '../../components/layout';

function StatusBadge({ status, label }: { status: CorporateEventStatus; label: string }) {
  return (
    <span className={`announcement-status announcement-status--${status.toLowerCase()}`}>
      {label}
    </span>
  );
}

export function EventsManagePage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<CorporateEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [pendingCancel, setPendingCancel] = useState<CorporateEvent | null>(null);

  const loadList = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetchEventsManage();
      setItems(res.items);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo cargar el listado');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  const runPublish = async (item: CorporateEvent) => {
    setActionLoading(true);
    setError('');
    try {
      await publishEvent(item.id);
      await loadList();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo publicar');
    } finally {
      setActionLoading(false);
    }
  };

  const runCancel = async (item: CorporateEvent) => {
    setActionLoading(true);
    setError('');
    try {
      await cancelEvent(item.id);
      await loadList();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo cancelar');
    } finally {
      setActionLoading(false);
      setPendingCancel(null);
    }
  };

  return (
    <>
      <PageHeader
        title="Gestión de Eventos"
        breadcrumbParent="Comunicación"
        breadcrumbCurrent="Gestión de Eventos"
        breadcrumbParentHref="/comunicados"
      />

      <AdminGovernanceBanner title="Eventos corporativos" variant="support-ti">
        <p>
          Cree y publique eventos para colaboradores. Puede dirigirlos a toda la empresa o a áreas
          específicas. Los borradores no son visibles hasta publicarlos.
        </p>
      </AdminGovernanceBanner>

      <div className="learning-manage-toolbar card-style mb-30">
        <Link to="/eventos" className="admin-btn admin-btn--ghost">
          <ArrowLeft size={16} aria-hidden />
          Ver eventos publicados
        </Link>
        <div className="learning-manage-toolbar__actions">
          <Link to="/admin/eventos/nuevo" className="admin-btn admin-btn--primary">
            <Plus size={16} aria-hidden />
            Nuevo evento
          </Link>
          <button
            type="button"
            className="admin-btn admin-btn--ghost"
            onClick={() => void loadList()}
          >
            <RefreshCw size={16} aria-hidden />
            Actualizar
          </button>
        </div>
      </div>

      {error && <div className="admin-alert admin-alert--error mb-20">{error}</div>}

      <div className="card-style mb-30">
        <div className="table-responsive">
          <table className="table top-selling-table admin-table">
            <thead>
              <tr>
                <th>Título</th>
                <th>Audiencia</th>
                <th>Inicio</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5}>Cargando…</td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={5}>No hay eventos registrados.</td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <button
                        type="button"
                        className="admin-link-btn"
                        onClick={() => navigate(`/admin/eventos/${item.id}/editar`)}
                      >
                        {item.title}
                      </button>
                    </td>
                    <td>{item.audienceLabel}</td>
                    <td>{new Date(item.startDateTime).toLocaleString('es-PA')}</td>
                    <td>
                      <StatusBadge status={item.status} label={item.statusLabel} />
                    </td>
                    <td>
                      <div className="admin-table__actions">
                        {item.status === 'PUBLISHED' ? (
                          <Link
                            to={`/eventos/${item.id}`}
                            className="admin-btn admin-btn--ghost admin-btn--sm"
                            title="Ver publicado"
                          >
                            <Eye size={14} aria-hidden />
                          </Link>
                        ) : null}
                        {item.status === 'DRAFT' ? (
                          <button
                            type="button"
                            className="admin-btn admin-btn--primary admin-btn--sm"
                            disabled={actionLoading}
                            onClick={() => void runPublish(item)}
                          >
                            Publicar
                          </button>
                        ) : null}
                        {item.status !== 'CANCELLED' ? (
                          <button
                            type="button"
                            className="admin-btn admin-btn--ghost admin-btn--sm"
                            disabled={actionLoading}
                            onClick={() => setPendingCancel(item)}
                          >
                            Cancelar
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ConfirmModal
        open={Boolean(pendingCancel)}
        title="Cancelar evento"
        message={
          pendingCancel
            ? `¿Confirma cancelar «${pendingCancel.title}»? Dejará de mostrarse a los colaboradores.`
            : ''
        }
        confirmLabel="Cancelar evento"
        loading={actionLoading}
        onConfirm={() => pendingCancel && void runCancel(pendingCancel)}
        onCancel={() => setPendingCancel(null)}
      />
    </>
  );
}
