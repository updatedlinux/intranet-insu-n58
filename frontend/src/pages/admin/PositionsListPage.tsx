import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, RefreshCw } from 'lucide-react';
import { ApiError } from '../../api/client';
import { fetchAreas } from '../../api/areas';
import type { Area } from '../../api/areas.types';
import { fetchPositions, togglePositionStatus, deletePosition } from '../../api/positions';
import type { Position } from '../../api/positions.types';
import { AdminGovernanceBanner } from '../../components/admin/AdminGovernanceBanner';
import { ConfirmModal } from '../../components/admin/ConfirmModal';
import { PageHeader } from '../../components/layout';
import { Select } from '../../components/ui/Select';

type PendingToggle = { position: Position; isActive: boolean };

function StatusBadge({ active }: { active: boolean }) {
  if (!active) {
    return <span className="admin-badge admin-badge--inactive">Inactivo</span>;
  }
  return <span className="admin-badge admin-badge--active">Activo</span>;
}

export function PositionsListPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<Position[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [pending, setPending] = useState<PendingToggle | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Position | null>(null);

  const [nameFilter, setNameFilter] = useState('');
  const [areaFilter, setAreaFilter] = useState('');
  const [isActiveFilter, setIsActiveFilter] = useState('');

  useEffect(() => {
    void fetchAreas().then((res) => setAreas(res.items));
  }, []);

  const loadList = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetchPositions({
        name: nameFilter || undefined,
        areaId: areaFilter ? Number.parseInt(areaFilter, 10) : undefined,
        isActive: isActiveFilter === '' ? undefined : isActiveFilter === 'true',
      });
      setItems(res.items);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo cargar el listado');
    } finally {
      setLoading(false);
    }
  }, [nameFilter, areaFilter, isActiveFilter]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  const runToggle = async (position: Position, isActive: boolean) => {
    setActionLoading(true);
    setError('');
    try {
      await togglePositionStatus(position.id, isActive);
      await loadList();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo completar la acción');
    } finally {
      setActionLoading(false);
    }
  };

  const requestToggle = (position: Position, isActive: boolean) => {
    if (!isActive && position.collaboratorCount > 0) {
      setPending({ position, isActive });
      return;
    }
    void runToggle(position, isActive);
  };

  const handleConfirmToggle = async () => {
    if (!pending) return;
    const { position, isActive } = pending;
    setPending(null);
    await runToggle(position, isActive);
  };

  const needsCollaboratorWarning =
    pending != null && !pending.isActive && pending.position.collaboratorCount > 0;

  const runDelete = async () => {
    if (!pendingDelete) return;
    setActionLoading(true);
    setError('');
    try {
      await deletePosition(pendingDelete.id);
      setPendingDelete(null);
      await loadList();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo eliminar el cargo');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Cargos"
        breadcrumbParent="Administración"
        breadcrumbCurrent="Cargos"
        breadcrumbParentHref="/admin/positions"
      />

      <AdminGovernanceBanner title="Cargos por área" variant="support-ti">
        <p>
          Catálogo de puestos asociados a cada unidad. Se usan al registrar colaboradores y en el
          directorio corporativo.
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
              value={areaFilter}
              onChange={setAreaFilter}
              options={[
                { value: '', label: 'Todas las áreas' },
                ...areas.map((a) => ({ value: String(a.id), label: a.name })),
              ]}
            />
          </div>
          <div className="col-lg-3 col-md-4">
            <Select
              value={isActiveFilter}
              onChange={setIsActiveFilter}
              options={[
                { value: '', label: 'Todos los estados' },
                { value: 'true', label: 'Activos' },
                { value: 'false', label: 'Inactivos' },
              ]}
            />
          </div>
        </div>
        <div className="learning-manage-toolbar__actions">
          <Link to="/admin/positions/nuevo" className="admin-btn admin-btn--primary">
            <Plus size={16} aria-hidden />
            Nuevo cargo
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
                <th>Área</th>
                <th>Estado</th>
                <th className="text-end">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} className="text-center text-gray py-4">
                    Cargando cargos…
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center text-gray py-4">
                    No se encontraron cargos con los filtros aplicados.
                  </td>
                </tr>
              ) : (
                items.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <button
                        type="button"
                        className="admin-link-btn"
                        onClick={() => navigate(`/admin/positions/${p.id}/editar`)}
                      >
                        {p.name}
                      </button>
                    </td>
                    <td>{p.areaName}</td>
                    <td>
                      <StatusBadge active={p.isActive} />
                    </td>
                    <td>
                      <div className="admin-row-actions">
                        <Link
                          to={`/admin/positions/${p.id}/editar`}
                          className="admin-btn admin-btn--ghost admin-btn--sm"
                        >
                          Editar
                        </Link>
                        <button
                          type="button"
                          className="admin-btn admin-btn--ghost admin-btn--sm"
                          onClick={() => requestToggle(p, !p.isActive)}
                        >
                          {p.isActive ? 'Inactivar' : 'Activar'}
                        </button>
                        <button
                          type="button"
                          className="admin-btn admin-btn--ghost admin-btn--sm"
                          onClick={() => setPendingDelete(p)}
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
        title={pending?.isActive ? 'Activar cargo' : 'Inactivar cargo'}
        message={
          pending ? (
            <>
              ¿Confirma {pending.isActive ? 'activar' : 'inactivar'} el cargo{' '}
              <strong>{pending.position.name}</strong>?
              {needsCollaboratorWarning && (
                <p className="admin-modal__warning mt-2">
                  Este cargo tiene {pending.position.collaboratorCount} colaborador
                  {pending.position.collaboratorCount === 1 ? '' : 'es'} asignado
                  {pending.position.collaboratorCount === 1 ? '' : 's'}
                  {pending.position.activeCollaboratorCount > 0 && (
                    <>
                      {' '}
                      ({pending.position.activeCollaboratorCount} activo
                      {pending.position.activeCollaboratorCount === 1 ? '' : 's'})
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

      <ConfirmModal
        open={pendingDelete != null}
        title="Eliminar cargo"
        message={
          pendingDelete ? (
            pendingDelete.collaboratorCount > 0 ? (
              <>
                El cargo <strong>{pendingDelete.name}</strong> tiene{' '}
                {pendingDelete.collaboratorCount} colaborador
                {pendingDelete.collaboratorCount === 1 ? '' : 'es'} asignado
                {pendingDelete.collaboratorCount === 1 ? '' : 's'}. Reasígnelos antes de eliminar.
              </>
            ) : (
              <>
                ¿Eliminar el cargo <strong>{pendingDelete.name}</strong>? Esta acción no se puede
                deshacer.
              </>
            )
          ) : null
        }
        variant="danger"
        confirmLabel={pendingDelete?.collaboratorCount ? 'Entendido' : 'Eliminar'}
        loading={actionLoading}
        onConfirm={() =>
          pendingDelete?.collaboratorCount ? setPendingDelete(null) : void runDelete()
        }
        onCancel={() => setPendingDelete(null)}
      />
    </>
  );
}
