import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, RefreshCw } from 'lucide-react';
import { ApiError } from '../../api/client';
import { fetchAreas, toggleAreaStatus, deleteArea } from '../../api/areas';
import type { Area } from '../../api/areas.types';
import { AdminGovernanceBanner } from '../../components/admin/AdminGovernanceBanner';
import { AreaDeleteModal } from '../../components/admin/AreaDeleteModal';
import { ConfirmModal } from '../../components/admin/ConfirmModal';
import { PageHeader } from '../../components/layout';
import { Select } from '../../components/ui/Select';

type PendingToggle = { area: Area; isActive: boolean };

function StatusBadge({ active }: { active: boolean }) {
  if (!active) {
    return <span className="admin-badge admin-badge--inactive">Inactiva</span>;
  }
  return <span className="admin-badge admin-badge--active">Activa</span>;
}

export function AreasListPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<Area[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [pending, setPending] = useState<PendingToggle | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Area | null>(null);

  const [nameFilter, setNameFilter] = useState('');
  const [isActiveFilter, setIsActiveFilter] = useState('');

  const loadList = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetchAreas({
        name: nameFilter || undefined,
        isActive: isActiveFilter === '' ? undefined : isActiveFilter === 'true',
      });
      setItems(res.items);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo cargar el listado');
    } finally {
      setLoading(false);
    }
  }, [nameFilter, isActiveFilter]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  const handleConfirmToggle = async () => {
    if (!pending) return;
    const { area, isActive } = pending;
    setPending(null);
    await runToggle(area, isActive);
  };

  const runToggle = async (area: Area, isActive: boolean) => {
    setActionLoading(true);
    setError('');
    try {
      await toggleAreaStatus(area.id, isActive);
      await loadList();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo completar la acción');
    } finally {
      setActionLoading(false);
    }
  };

  const requestToggle = (area: Area, isActive: boolean) => {
    if (!isActive && area.collaboratorCount > 0) {
      setPending({ area, isActive });
      return;
    }
    void runToggle(area, isActive);
  };

  const needsCollaboratorWarning =
    pending != null && !pending.isActive && pending.area.collaboratorCount > 0;

  const runDelete = async (payload: {
    taskAction?: 'transfer' | 'delete';
    transferToAreaId?: number;
  }) => {
    if (!pendingDelete) return;
    setActionLoading(true);
    setError('');
    try {
      await deleteArea(pendingDelete.id, payload);
      setPendingDelete(null);
      await loadList();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo eliminar el área');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Áreas"
        breadcrumbParent="Administración"
        breadcrumbCurrent="Áreas"
        breadcrumbParentHref="/admin/areas"
      />

      <AdminGovernanceBanner title="Estructura organizacional" variant="support-ti">
        <p>
          Define las unidades de la organización, su jerarquía y los líderes asignados. Marque{' '}
          <strong>Área de Soporte TI</strong> en las unidades que operan la mesa de ayuda e
          inventario (ya no depende del nombre del área).
        </p>
      </AdminGovernanceBanner>

      <div className="learning-manage-toolbar card-style mb-30">
        <div className="admin-toolbar__filters row g-2 flex-grow-1">
          <div className="col-lg-4 col-md-6">
            <input
              className="admin-form__input"
              placeholder="Filtrar por nombre…"
              value={nameFilter}
              onChange={(e) => setNameFilter(e.target.value)}
            />
          </div>
          <div className="col-lg-3 col-md-4">
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
        </div>
        <div className="learning-manage-toolbar__actions">
          <Link to="/admin/areas/nuevo" className="admin-btn admin-btn--primary">
            <Plus size={16} aria-hidden />
            Nuevo área
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
                <th>Nombre</th>
                <th>Área padre</th>
                <th>Líderes</th>
                <th>Soporte TI</th>
                <th>Estado</th>
                <th className="text-end">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center text-gray py-4">
                    Cargando áreas…
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center text-gray py-4">
                    No se encontraron áreas con los filtros aplicados.
                  </td>
                </tr>
              ) : (
                items.map((a) => (
                  <tr key={a.id}>
                    <td>
                      <button
                        type="button"
                        className="admin-link-btn"
                        onClick={() => navigate(`/admin/areas/${a.id}/editar`)}
                      >
                        {a.name}
                      </button>
                    </td>
                    <td>{a.parentAreaName ?? '—'}</td>
                    <td>
                      {a.leaders.length > 0
                        ? a.leaders.map((l) => `${l.firstName} ${l.lastName}`.trim()).join(', ')
                        : '—'}
                    </td>
                    <td>
                      {a.isItSupportArea ? (
                        <span className="admin-badge admin-badge--active">Sí</span>
                      ) : (
                        <span className="text-gray">—</span>
                      )}
                    </td>
                    <td>
                      <StatusBadge active={a.isActive} />
                    </td>
                    <td>
                      <div className="admin-row-actions">
                        <Link
                          to={`/admin/areas/${a.id}/editar`}
                          className="admin-btn admin-btn--ghost admin-btn--sm"
                        >
                          Editar
                        </Link>
                        <button
                          type="button"
                          className="admin-btn admin-btn--ghost admin-btn--sm"
                          onClick={() => requestToggle(a, !a.isActive)}
                        >
                          {a.isActive ? 'Inactivar' : 'Activar'}
                        </button>
                        <button
                          type="button"
                          className="admin-btn admin-btn--ghost admin-btn--sm"
                          onClick={() => setPendingDelete(a)}
                          disabled={actionLoading}
                        >
                          Eliminar
                        </button>
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
        open={pending != null}
        title={pending?.isActive ? 'Activar área' : 'Inactivar área'}
        message={
          pending ? (
            <>
              ¿Confirma {pending.isActive ? 'activar' : 'inactivar'} el área{' '}
              <strong>{pending.area.name}</strong>?
              {needsCollaboratorWarning && (
                <p className="admin-modal__warning mt-2">
                  Esta área tiene {pending.area.collaboratorCount} colaborador
                  {pending.area.collaboratorCount === 1 ? '' : 'es'} asignado
                  {pending.area.collaboratorCount === 1 ? '' : 's'}
                  {pending.area.activeCollaboratorCount > 0 && (
                    <>
                      {' '}
                      ({pending.area.activeCollaboratorCount} activo
                      {pending.area.activeCollaboratorCount === 1 ? '' : 's'})
                    </>
                  )}
                  . Si hay colaboradores activos, la operación será rechazada por el sistema.
                </p>
              )}
            </>
          ) : null
        }
        variant={pending && !pending.isActive ? 'danger' : 'primary'}
        loading={actionLoading}
        onConfirm={handleConfirmToggle}
        onCancel={() => setPending(null)}
      />

      <AreaDeleteModal
        area={pendingDelete}
        areas={items}
        loading={actionLoading}
        onConfirm={(payload) => void runDelete(payload)}
        onCancel={() => setPendingDelete(null)}
      />
    </>
  );
}
