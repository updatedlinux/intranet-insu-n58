import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, RefreshCw, Headphones } from 'lucide-react';
import { ApiError } from '../../api/client';
import {
  fetchTicketCategories,
  toggleTicketCategoryStatus,
  deleteTicketCategory,
} from '../../api/ticket-categories';
import type { TicketCategory } from '../../api/ticket-categories.types';
import { ConfirmModal } from '../../components/admin/ConfirmModal';
import { AdminGovernanceBanner } from '../../components/admin/AdminGovernanceBanner';
import { PageHeader } from '../../components/layout';
import { Select } from '../../components/ui/Select';

function StatusBadge({ active }: { active: boolean }) {
  if (!active) {
    return <span className="admin-badge admin-badge--inactive">Inactiva</span>;
  }
  return <span className="admin-badge admin-badge--active">Activa</span>;
}

export function TicketCategoriesListPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<TicketCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [pendingDeactivate, setPendingDeactivate] = useState<TicketCategory | null>(null);
  const [pendingDelete, setPendingDelete] = useState<TicketCategory | null>(null);

  const [nameFilter, setNameFilter] = useState('');
  const [isActiveFilter, setIsActiveFilter] = useState('');

  const loadList = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetchTicketCategories({
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

  const runToggle = async (item: TicketCategory, isActive: boolean) => {
    setActionLoading(true);
    setError('');
    try {
      await toggleTicketCategoryStatus(item.id, isActive);
      await loadList();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo completar la acción');
    } finally {
      setActionLoading(false);
    }
  };

  const runDelete = async () => {
    if (!pendingDelete) return;
    setActionLoading(true);
    setError('');
    try {
      await deleteTicketCategory(pendingDelete.id);
      setPendingDelete(null);
      await loadList();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo eliminar la categoría');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Categorías Soporte TI"
        breadcrumbParent="Administración"
        breadcrumbCurrent="Categorías Soporte TI"
        breadcrumbParentHref="/admin/ticket-categories"
      />

      <AdminGovernanceBanner title="¿Qué gobierna esta sección?" variant="support-ti">
        <p>
          Define las categorías que los colaboradores eligen al <strong>crear tickets</strong> en
          Soporte TI (incidencias, accesos, equipos, etc.). No aplica al inventario de activos ni
          consumibles.
        </p>
        <ul>
          <li>Orden y estado (activa/inactiva) controlan el listado al abrir un ticket nuevo.</li>
          <li>No se puede inactivar una categoría con tickets asociados.</li>
          <li>
            Es independiente de <strong>Categorías de inventario</strong> en Administración.
          </li>
        </ul>
      </AdminGovernanceBanner>

      {error && <div className="admin-alert admin-alert--error mb-20">{error}</div>}

      <div className="learning-manage-toolbar card-style mb-30">
        <div className="learning-manage-toolbar__filters">
          <input
            className="admin-form__input admin-form__input--sm"
            placeholder="Filtrar por nombre…"
            value={nameFilter}
            onChange={(e) => setNameFilter(e.target.value)}
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
          <Link to="/admin/ticket-categories/nuevo" className="admin-btn admin-btn--primary">
            <Plus size={16} aria-hidden />
            Nueva categoría
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
          className="admin-data-list admin-data-list--ticket-categories"
          role="grid"
          aria-label="Categorías"
        >
          <div className="admin-data-list__header" role="row">
            <div role="columnheader">Nombre</div>
            <div role="columnheader">Descripción</div>
            <div className="admin-data-list__cell--center" role="columnheader">
              Orden
            </div>
            <div className="admin-data-list__cell--center" role="columnheader">
              Tickets
            </div>
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
                <Headphones size={32} strokeWidth={1.5} aria-hidden />
                <p>No hay categorías registradas.</p>
                <Link to="/admin/ticket-categories/nuevo" className="admin-link">
                  Crear la primera categoría
                </Link>
              </div>
            ) : (
              items.map((item) => (
                <div key={item.id} className="admin-data-list__row" role="row">
                  <div className="admin-data-list__name" role="cell">
                    <button
                      type="button"
                      className="admin-link-btn"
                      onClick={() => navigate(`/admin/ticket-categories/${item.id}/editar`)}
                    >
                      {item.name}
                    </button>
                  </div>
                  <div
                    className="admin-data-list__desc"
                    role="cell"
                    title={item.description ?? undefined}
                  >
                    {item.description ?? '—'}
                  </div>
                  <div className="admin-data-list__count admin-data-list__cell--center" role="cell">
                    {item.sortOrder}
                  </div>
                  <div className="admin-data-list__count admin-data-list__cell--center" role="cell">
                    {item.ticketCount}
                  </div>
                  <div className="admin-data-list__cell--center" role="cell">
                    <StatusBadge active={item.isActive} />
                  </div>
                  <div className="admin-data-list__cell--end" role="cell">
                    <div className="admin-row-actions">
                      <button
                        type="button"
                        className="admin-btn admin-btn--ghost admin-btn--sm"
                        onClick={() => navigate(`/admin/ticket-categories/${item.id}/editar`)}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        className="admin-btn admin-btn--ghost admin-btn--sm"
                        onClick={() =>
                          item.isActive && item.ticketCount > 0
                            ? setPendingDeactivate(item)
                            : void runToggle(item, !item.isActive)
                        }
                        disabled={actionLoading}
                      >
                        {item.isActive ? 'Inactivar' : 'Activar'}
                      </button>
                      <button
                        type="button"
                        className="admin-btn admin-btn--ghost admin-btn--sm"
                        onClick={() => setPendingDelete(item)}
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
            {items.length === 1 ? '1 categoría' : `${items.length} categorías`}
          </footer>
        )}
      </div>

      <ConfirmModal
        open={pendingDeactivate != null}
        title="Inactivar categoría"
        message={
          pendingDeactivate ? (
            <>
              La categoría <strong>{pendingDeactivate.name}</strong> tiene{' '}
              {pendingDeactivate.ticketCount} ticket(s) asociados. No se puede inactivar hasta que
              no haya tickets vinculados.
            </>
          ) : null
        }
        variant="danger"
        confirmLabel="Entendido"
        onConfirm={() => setPendingDeactivate(null)}
        onCancel={() => setPendingDeactivate(null)}
      />

      <ConfirmModal
        open={pendingDelete != null}
        title="Eliminar categoría"
        message={
          pendingDelete ? (
            pendingDelete.ticketCount > 0 ? (
              <>
                La categoría <strong>{pendingDelete.name}</strong> tiene {pendingDelete.ticketCount}{' '}
                ticket(s). No se puede eliminar hasta que no haya tickets vinculados.
              </>
            ) : (
              <>
                ¿Eliminar la categoría <strong>{pendingDelete.name}</strong>? Esta acción no se
                puede deshacer.
              </>
            )
          ) : null
        }
        variant="danger"
        confirmLabel={pendingDelete?.ticketCount ? 'Entendido' : 'Eliminar'}
        loading={actionLoading}
        onConfirm={() => (pendingDelete?.ticketCount ? setPendingDelete(null) : void runDelete())}
        onCancel={() => setPendingDelete(null)}
      />
    </>
  );
}
