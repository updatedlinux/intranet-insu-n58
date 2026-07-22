import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MessageCircle, Plus, RefreshCw } from 'lucide-react';
import { ApiError } from '../../api/client';
import { fetchChatExceptionsList, deleteChatException } from '../../api/chat-exceptions';
import type { ChatAreaAccessGrant } from '../../api/chat-exceptions.types';
import { fetchAreas } from '../../api/areas';
import type { Area } from '../../api/areas.types';
import { AdminGovernanceBanner } from '../../components/admin/AdminGovernanceBanner';
import { ConfirmModal } from '../../components/admin/ConfirmModal';
import { PageHeader } from '../../components/layout';
import { Select } from '../../components/ui/Select';

type StatusFilter = 'all' | 'active' | 'inactive';

function StatusBadge({ active }: { active: boolean }) {
  if (!active) {
    return <span className="admin-badge admin-badge--inactive">Inactiva</span>;
  }
  return <span className="admin-badge admin-badge--active">Activa</span>;
}

export function ChatExceptionsListPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<ChatAreaAccessGrant[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<ChatAreaAccessGrant | null>(null);

  const [areaFilter, setAreaFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const loadList = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetchChatExceptionsList({
        areaId: areaFilter ? Number.parseInt(areaFilter, 10) : undefined,
        isActive: statusFilter === 'all' ? undefined : statusFilter === 'active',
      });
      setItems(res.items);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudieron cargar las excepciones');
    } finally {
      setLoading(false);
    }
  }, [areaFilter, statusFilter]);

  useEffect(() => {
    void fetchAreas({ isActive: true })
      .then((r) => setAreas(r.items))
      .catch(() => setAreas([]));
  }, []);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  const filteredCountLabel = useMemo(() => {
    if (items.length === 1) return '1 excepción';
    return `${items.length} excepciones`;
  }, [items.length]);

  const runDelete = async () => {
    if (!pendingDelete) return;
    setActionLoading(true);
    setError('');
    try {
      await deleteChatException(pendingDelete.id);
      setPendingDelete(null);
      await loadList();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo eliminar la excepción');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Excepciones de chat"
        breadcrumbParent="Administración"
        breadcrumbCurrent="Excepciones de chat"
        breadcrumbParentHref="/admin/chat-exceptions"
      />

      <AdminGovernanceBanner title="Acceso a chats grupales" variant="support-ti">
        <p>
          Permite que un colaborador participe en el <strong>chat grupal de otra unidad</strong>{' '}
          distinta a la suya (por ejemplo, un gerente de TTHH que también coordina Administración).
        </p>
      </AdminGovernanceBanner>

      <div className="learning-manage-toolbar card-style mb-30">
        <div className="learning-manage-toolbar__filters">
          <Select
            value={areaFilter}
            onChange={setAreaFilter}
            options={[
              { value: '', label: 'Todas las unidades' },
              ...areas.map((a) => ({ value: String(a.id), label: a.name })),
            ]}
          />

          <div className="learning-manage-tabs" role="tablist" aria-label="Filtrar por estado">
            {(
              [
                ['all', 'Todas'],
                ['active', 'Activas'],
                ['inactive', 'Inactivas'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={statusFilter === value}
                className={`learning-manage-tabs__btn${statusFilter === value ? ' is-active' : ''}`}
                onClick={() => setStatusFilter(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="learning-manage-toolbar__actions">
          <Link to="/admin/chat-exceptions/nuevo" className="admin-btn admin-btn--primary">
            <Plus size={16} aria-hidden />
            Nueva excepción
          </Link>
          <button
            type="button"
            className="admin-btn admin-btn--ghost"
            onClick={() => void loadList()}
            disabled={loading}
          >
            <RefreshCw size={16} aria-hidden />
            Actualizar
          </button>
        </div>
      </div>

      {error ? <div className="admin-alert admin-alert--error mb-20">{error}</div> : null}

      <div className="card-style admin-data-library mb-30">
        <div
          className="admin-data-list admin-data-list--chat-exceptions"
          role="grid"
          aria-label="Excepciones de chat"
        >
          <div className="admin-data-list__header" role="row">
            <div role="columnheader">Colaborador</div>
            <div role="columnheader">Unidad del colaborador</div>
            <div role="columnheader">Chat grupal de</div>
            <div role="columnheader">Notas</div>
            <div className="admin-data-list__cell--center" role="columnheader">
              Estado
            </div>
            <div className="admin-data-list__cell--end" role="columnheader">
              Acciones
            </div>
          </div>

          <div className="admin-data-list__body">
            {loading ? (
              <div className="admin-data-list__empty">Cargando…</div>
            ) : items.length === 0 ? (
              <div className="learning-manage-empty">
                <MessageCircle size={32} strokeWidth={1.5} aria-hidden />
                <p>No hay excepciones registradas.</p>
                <Link to="/admin/chat-exceptions/nuevo" className="admin-link">
                  Crear la primera excepción
                </Link>
              </div>
            ) : (
              items.map((grant) => (
                <div key={grant.id} className="admin-data-list__row" role="row">
                  <div className="admin-data-list__name" role="cell" title={grant.userFullName}>
                    {grant.userFullName}
                    <div className="text-gray small">{grant.userEmail}</div>
                  </div>
                  <div className="admin-data-list__name" role="cell" title={grant.userAreaName}>
                    {grant.userAreaName}
                  </div>
                  <div className="admin-data-list__name" role="cell" title={grant.areaName}>
                    {grant.areaName}
                  </div>
                  <div
                    role="cell"
                    className="admin-data-list__notes"
                    title={grant.notes ?? undefined}
                  >
                    {grant.notes || '—'}
                  </div>
                  <div className="admin-data-list__cell--center" role="cell">
                    <StatusBadge active={grant.isActive} />
                  </div>
                  <div className="admin-data-list__cell--end" role="cell">
                    <div className="admin-row-actions">
                      <button
                        type="button"
                        className="admin-btn admin-btn--ghost admin-btn--sm"
                        onClick={() => navigate(`/admin/chat-exceptions/${grant.id}/editar`)}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        className="admin-btn admin-btn--ghost admin-btn--sm"
                        onClick={() => setPendingDelete(grant)}
                        disabled={actionLoading}
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {!loading && items.length > 0 ? (
          <footer className="admin-data-library__footer">{filteredCountLabel}</footer>
        ) : null}
      </div>

      <ConfirmModal
        open={pendingDelete != null}
        title="Eliminar excepción de chat"
        message={
          pendingDelete ? (
            <>
              ¿Eliminar el acceso de <strong>{pendingDelete.userFullName}</strong> al chat grupal de{' '}
              <strong>{pendingDelete.areaName}</strong>? Esta acción no se puede deshacer.
            </>
          ) : null
        }
        variant="danger"
        confirmLabel="Eliminar"
        loading={actionLoading}
        onConfirm={() => void runDelete()}
        onCancel={() => setPendingDelete(null)}
      />
    </>
  );
}
