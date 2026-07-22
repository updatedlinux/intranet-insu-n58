import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, RefreshCw, Shield } from 'lucide-react';
import { ApiError } from '../../api/client';
import { fetchAreaAccessList, deleteAreaAccess } from '../../api/area-access';
import type { AreaAccessGrant } from '../../api/area-access.types';
import { fetchAreas } from '../../api/areas';
import type { Area } from '../../api/areas.types';
import { PageHeader } from '../../components/layout';
import { AdminGovernanceBanner } from '../../components/admin/AdminGovernanceBanner';
import { ConfirmModal } from '../../components/admin/ConfirmModal';
import { Select } from '../../components/ui/Select';

function StatusBadge({ active }: { active: boolean }) {
  if (!active) {
    return <span className="admin-badge admin-badge--inactive">Inactiva</span>;
  }
  return <span className="admin-badge admin-badge--active">Activa</span>;
}

function PermissionBadges({ grant }: { grant: AreaAccessGrant }) {
  return (
    <div className="area-access-perms">
      {grant.canRead && <span className="admin-badge admin-badge--perm">Leer</span>}
      {grant.canUpload && <span className="admin-badge admin-badge--perm">Subir</span>}
      {grant.canApprove && <span className="admin-badge admin-badge--perm">Aprobar</span>}
      {grant.canAnnounce && <span className="admin-badge admin-badge--perm">Comunicados</span>}
      {!grant.canRead && !grant.canUpload && !grant.canApprove && !grant.canAnnounce && (
        <span className="text-gray">Sin permisos</span>
      )}
    </div>
  );
}

export function AreaAccessListPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<AreaAccessGrant[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<AreaAccessGrant | null>(null);

  const [sourceFilter, setSourceFilter] = useState('');
  const [targetFilter, setTargetFilter] = useState('');
  const [isActiveFilter, setIsActiveFilter] = useState('');

  const loadList = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetchAreaAccessList({
        sourceAreaId: sourceFilter ? Number.parseInt(sourceFilter, 10) : undefined,
        targetAreaId: targetFilter ? Number.parseInt(targetFilter, 10) : undefined,
        isActive: isActiveFilter === '' ? undefined : isActiveFilter === 'true',
      });
      setItems(res.items);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo cargar el listado');
    } finally {
      setLoading(false);
    }
  }, [sourceFilter, targetFilter, isActiveFilter]);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetchAreas({ isActive: true });
        setAreas(res.items);
      } catch {
        /* filtros opcionales */
      }
    })();
  }, []);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  const runDelete = async () => {
    if (!pendingDelete) return;
    setActionLoading(true);
    setError('');
    try {
      await deleteAreaAccess(pendingDelete.id);
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
        title="Acceso entre áreas"
        breadcrumbParent="Administración"
        breadcrumbCurrent="Acceso entre áreas"
        breadcrumbParentHref="/admin/area-access"
      />

      {error && <div className="admin-alert admin-alert--error mb-20">{error}</div>}

      <AdminGovernanceBanner title="Acceso entre áreas" variant="support-ti">
        <p>
          Excepciones para la <strong>gestión de documentos</strong> entre unidades: permite que
          colaboradores de un área accedan al repositorio de otra (ver, subir, aprobar o enviar
          comunicados, según los permisos que defina).
        </p>
      </AdminGovernanceBanner>

      <div className="learning-manage-toolbar card-style mb-30">
        <div className="learning-manage-toolbar__filters">
          <Select
            value={sourceFilter}
            onChange={setSourceFilter}
            options={[
              { value: '', label: 'Todas las áreas origen' },
              ...areas.map((area) => ({ value: String(area.id), label: area.name })),
            ]}
          />
          <Select
            value={targetFilter}
            onChange={setTargetFilter}
            options={[
              { value: '', label: 'Todas las áreas destino' },
              ...areas.map((area) => ({ value: String(area.id), label: area.name })),
            ]}
          />
          <Select
            value={isActiveFilter}
            onChange={setIsActiveFilter}
            options={[
              { value: '', label: 'Todos los estados' },
              { value: 'true', label: 'Activas' },
              { value: 'false', label: 'Inactivas' },
            ]}
          />
        </div>
        <div className="learning-manage-toolbar__actions">
          <Link to="/admin/area-access/nuevo" className="admin-btn admin-btn--primary">
            <Plus size={16} aria-hidden />
            Nueva excepción
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

      <div className="card-style admin-data-library mb-30">
        <div
          className="admin-data-list admin-data-list--area-access"
          role="grid"
          aria-label="Acceso entre áreas"
        >
          <div className="admin-data-list__header" role="row">
            <div role="columnheader">Área origen</div>
            <div role="columnheader">Área destino</div>
            <div role="columnheader">Permisos</div>
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
                <Shield size={32} strokeWidth={1.5} aria-hidden />
                <p>No hay excepciones registradas.</p>
                <Link to="/admin/area-access/nuevo" className="admin-link">
                  Crear la primera excepción
                </Link>
              </div>
            ) : (
              items.map((grant) => (
                <div key={grant.id} className="admin-data-list__row" role="row">
                  <div className="admin-data-list__name" role="cell" title={grant.sourceAreaName}>
                    {grant.sourceAreaName}
                  </div>
                  <div className="admin-data-list__name" role="cell" title={grant.targetAreaName}>
                    {grant.targetAreaName}
                  </div>
                  <div role="cell">
                    <PermissionBadges grant={grant} />
                  </div>
                  <div className="admin-data-list__cell--center" role="cell">
                    <StatusBadge active={grant.isActive} />
                  </div>
                  <div className="admin-data-list__cell--end" role="cell">
                    <div className="admin-row-actions">
                      <button
                        type="button"
                        className="admin-btn admin-btn--ghost admin-btn--sm"
                        onClick={() => navigate(`/admin/area-access/${grant.id}/editar`)}
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

        {!loading && items.length > 0 && (
          <footer className="admin-data-library__footer">
            {items.length === 1 ? '1 excepción' : `${items.length} excepciones`}
          </footer>
        )}
      </div>

      <ConfirmModal
        open={pendingDelete != null}
        title="Eliminar excepción de acceso"
        message={
          pendingDelete ? (
            <>
              ¿Eliminar el acceso de <strong>{pendingDelete.sourceAreaName}</strong> hacia{' '}
              <strong>{pendingDelete.targetAreaName}</strong>? Esta acción no se puede deshacer.
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
